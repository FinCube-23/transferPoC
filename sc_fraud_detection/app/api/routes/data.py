"""
Data management endpoints

Handles data uploading, loading, and database operations
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, UploadFile, File
import logging

from app.services.opensearch_service import OpenSearchService
from app.scraper.data_scraper import DataScraper
from app.utils.feature_extractor import FeatureExtractor
from app.api.deps import get_opensearch_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/stats")
async def get_stats(
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """Get database statistics"""
    try:
        stats = opensearch_service.get_index_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-csv")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file:UploadFile=File(
        ...,
        description=(
            "⚠️ **WARNING**: CSV file must contain fraud detection features. "
            "Result quality may decrease if the dataset does not have proper columns. "
            "\n\n**Required columns** (at least 50% must be present):\n"
            "Address, FLAG, Avg min between sent tnx, Avg min between received tnx, "
            "Time Diff between first and last (Mins), Sent tnx, Received Tnx, "
            "Number of Created Contracts, Unique Received From Addresses, "
            "Unique Sent To Addresses, min value received, max value received, "
            "avg val received, min val sent, max val sent, avg val sent, "
            "min value sent to contract, max val sent to contract, "
            "avg value sent to contract, total transactions (including tnx to create contract), "
            "total Ether sent, total ether received, total ether sent contracts, "
            "total ether balance, Total ERC20 tnxs, ERC20 total Ether received, "
            "ERC20 total ether sent, ERC20 total Ether sent contract, "
            "ERC20 uniq sent addr, ERC20 uniq rec addr, ERC20 uniq sent addr.1, "
            "ERC20 uniq rec contract addr, ERC20 avg time between sent tnx, "
            "ERC20 avg time between rec tnx, ERC20 avg time between rec 2 tnx, "
            "ERC20 avg time between contract tnx, ERC20 min val rec, ERC20 max val rec, "
            "ERC20 avg val rec, ERC20 min val sent, ERC20 max val sent, "
            "ERC20 avg val sent, ERC20 min val sent contract, ERC20 max val sent contract, "
            "ERC20 avg val sent contract, ERC20 uniq sent token name, "
            "ERC20 uniq rec token name, ERC20 most sent token type, "
            "ERC20_most_rec_token_type"
        )
    ),
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """
    Upload CSV file with fraud detection data and load into vector database
    
    ⚠️ **IMPORTANT NOTES**:
    - File must be in CSV format
    - At least 50% of required columns must be present
    - Missing columns will be filled with default values
    - Extra columns will be ignored
    - Result quality depends on dataset completeness
    
    This endpoint processes the CSV in the background.
    """
    try:
        # Validate file type.
        if not file.filename.endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Only CSV files are accepted. Please upload a .csv file"
            )

        # Read file content
        content=await file.read()

        if len(content)==0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # start processing in background
        background_tasks.add_task(
            _process_and_load,
            content,
            file.filename,
            opensearch_service
        )

        return {
            "status": "started",
            "message": "CSV processing started in background",
            "filename": file.filename,
            "file_size_bytes": len(content)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in starting CSV upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/index")
async def delete_index(
    opensearch_service: OpenSearchService = Depends(get_opensearch_service)
):
    """Delete the vector database index (use with caution)"""
    try:
        opensearch_service.delete_index()
        return {"status": "success", "message": "Index deleted"}
    except Exception as e:
        logger.error(f"Error deleting index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _process_and_load(
    file_content:bytes,
    filename:str,
    opensearch_service: OpenSearchService
):
    """Background task to process CSV and load data"""
    try:
        logger.info(f"Starting CSV processing for file: {filename}")

        # Initialize scraper
        scraper=DataScraper()

        # process CSV
        records,validation_info=await scraper.process_csv_upload(file_content)
        logger.info(f"CSV validation: {validation_info}")

        # Log warning if coverage is low
        if validation_info["coverage_percentage"] < 75:
            logger.warning(
                f"Low column coverage ({validation_info['coverage_percentage']}%). "
                "Result quality may be affected."
            )
        
        logger.info(f"Processing {len(records)} records")

        # Process records and collect feature vectors.
        processed_records=[]
        all_feature_vectors=[]

        for record in records:
            try:
                # Extract features
                features_dict={}
                for k,v in record.items():
                    if k in ["Index","Address","FLAG"]:
                        continue
                    try:
                        if v is None or (isinstance(v,str) and v.strip()==""):
                            features_dict[k]=0.0
                        else:
                            val=float(v)
                            if val != val or val == float('inf') or val == float('-inf'):
                                features_dict[k] = 0.0
                            else:
                                features_dict[k] = val
                    except (ValueError,TypeError):
                        features_dict[k]=0.0
                
                valid_features={k:v for k,v in features_dict.items() if k in FeatureExtractor.FEATURE_NAMES}

                feature_vector=FeatureExtractor.features_to_vector(valid_features)
                feature_vector=[0.0 if (x!=x or x==float('inf') or x==float('-inf')) else x for x in feature_vector]

                all_feature_vectors.append(feature_vector)

                processed_records.append({
                    "address": str(record.get("Address", "")).lower(),
                    "flag": int(record.get("FLAG", 0)) if record.get("FLAG") not in [None, '', ' '] else 0,
                    "features": feature_vector,
                    "feature_dict": valid_features
                })
            except Exception as e:
                logger.warning(f"Error processing record: {e}")
                continue

        # FIT SCALER on dataset features
        logger.info("Fitting feature scaler...")
        FeatureExtractor.fit_scaler(all_feature_vectors)
        
        # NORMALIZE all feature vectors
        logger.info("Normalizing feature vectors...")
        for record in processed_records:
            record["features"] = FeatureExtractor.normalize_vector(record["features"])
        
        # Bulk insert
        logger.info(f"Inserting {len(processed_records)} records into OpenSearch")
        success, failed = opensearch_service.bulk_insert(processed_records)
        
        logger.info(
            f"Data load complete for {filename}: "
            f"{success} succeeded, {len(failed)} failed. "
            f"Validation: {validation_info}"
        )


    except ValueError as e:
        # Validation errors (like <50% columns)
        logger.error(f"CSV validation failed for {filename}: {e}")
    except Exception as e:
        logger.error(f"Error in CSV processing and load for {filename}: {e}", exc_info=True)
