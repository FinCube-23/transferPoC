import pandas as pd
from typing import List, Dict, Any, Tuple
import logging
import io

logger = logging.getLogger(__name__)


class DataScraper:
    """
    CSV file upload handler with validatioin and default value insertion.
    """

    REQUIRED_COLUMNS = [
        "Address", "FLAG", "Avg min between sent tnx", "Avg min between received tnx",
        "Time Diff between first and last (Mins)", "Sent tnx", "Received Tnx",
        "Number of Created Contracts", "Unique Received From Addresses",
        "Unique Sent To Addresses", "min value received", "max value received",
        "avg val received", "min val sent", "max val sent", "avg val sent",
        "min value sent to contract", "max val sent to contract",
        "avg value sent to contract", "total transactions (including tnx to create contract)",
        "total Ether sent", "total ether received", "total ether sent contracts",
        "total ether balance", "Total ERC20 tnxs", "ERC20 total Ether received",
        "ERC20 total ether sent", "ERC20 total Ether sent contract",
        "ERC20 uniq sent addr", "ERC20 uniq rec addr", "ERC20 uniq sent addr.1",
        "ERC20 uniq rec contract addr", "ERC20 avg time between sent tnx",
        "ERC20 avg time between rec tnx", "ERC20 avg time between rec 2 tnx",
        "ERC20 avg time between contract tnx", "ERC20 min val rec", "ERC20 max val rec",
        "ERC20 avg val rec", "ERC20 min val sent", "ERC20 max val sent",
        "ERC20 avg val sent", "ERC20 min val sent contract", "ERC20 max val sent contract",
        "ERC20 avg val sent contract", "ERC20 uniq sent token name",
        "ERC20 uniq rec token name", "ERC20 most sent token type",
        "ERC20_most_rec_token_type"
    ]

    # Default Value in order.
    DEFAULT_VALUES = [
        "0x00009277775ac7d0d59eaad8fee3d10ac6c805e8", 0, 844.26, 1093.71, 704785.63,
        721, 89, 0, 40, 118, 0.0, 45.806785, 6.589513, 0.0, 31.22, 1.200681,
        0.0, 0.0, 0.0, 810, 865.6910932, 586.4666748, 0.0, -279.2244185,
        265.0, 35588543.78, 35603169.52, 0.0, 30.0, 54.0, 0.0, 58.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 15000000.0, 265586.1476, 0.0,
        16830998.35, 271779.92, 0.0, 0.0, 0.0, 39.0, 57.0,
        "Cofoundit", "Numeraire"
    ]


    def __init__(self):
        self.default_row=dict(zip(self.REQUIRED_COLUMNS,self.DEFAULT_VALUES))

    async def process_csv_upload(
        self,
        file_content:bytes
    )->Tuple[List[Dict[str,Any]],Dict[str,Any]]:
        """
        Process uploaded CSV file
        
        Args:
            file_content: Raw bytes of the CSV file
        
        Returns:
            Tuple of (records list, validation info dict)
        
        Raises:
            ValueError: If less than 50% of required columns are present
        """
        try:
            df=pd.read_csv(io.BytesIO(file_content))
            logger.info(f"✅ Loaded CSV with {len(df)} rows and {len(df.columns)} columns")

            present_columns=set(df.columns)
            required_columns=set(self.REQUIRED_COLUMNS)
            matching_columns=present_columns.intersection(required_columns)
            coverage_percentage=(len(matching_columns)/len(required_columns))*100

            missing_count=len(required_columns)-len(matching_columns)

            if coverage_percentage<50:
                raise ValueError(
                    f"Insufficient columns: Only {coverage_percentage:.1f}% of required columns present. "
                    f"Need at least 50%. Missing {missing_count} required columns."
                )

            # Add missing columns with default value
            for col in self.REQUIRED_COLUMNS:
                if col not in df.columns:
                    default_val=self.default_row[col]
                    df[col]=default_val

            # Remove extra columns that are not in required columns
            df=df[self.REQUIRED_COLUMNS]

            # Convert to list of dicts.
            records=df.to_dict(orient="records")

            # validation info
            validation_info={
                "total_rows": len(records),
                "total_columns": len(self.REQUIRED_COLUMNS),
                "columns_provided": len(matching_columns),
                "columns_missing": missing_count,
                "coverage_percentage": round(coverage_percentage, 2),
                "missing_columns": list(required_columns - matching_columns),
                "extra_columns_ignored": list(present_columns - required_columns)
            }

            logger.info(f"CSV Processing completed: {validation_info}")

            return records, validation_info

        except pd.errors.EmptyDataError:
            logger.error("CSV file is empty.")
            raise ValueError("CSV file is empty.")
        except pd.errors.ParserError as e:
            logger.error(f"Parsing CSV error: {e}")
            raise ValueError(f"Parsing CSV error: {e}")
        except Exception as e:
            logger.error(f"Error processing CSV upload: {e}")
            raise