import os
import pandas as pd
import httpx
from typing import List, Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class DataScraper:
    """Generic data scraper supporting multiple sources"""
    
    def __init__(self, kaggle_username: str = None, kaggle_key: str = None):
        self.kaggle_username = kaggle_username or os.getenv("KAGGLE_USERNAME")
        self.kaggle_key = kaggle_key or os.getenv("KAGGLE_KEY")
        self.temp_dir = Path("/tmp/fraud_detection_data")
        self.temp_dir.mkdir(exist_ok=True)
    
    async def scrape(self, source_url: str, source_type: str = "kaggle") -> List[Dict[str, Any]]:
        """
        Scrape data from various sources
        
        Args:
            source_url: URL or identifier of the data source
            source_type: Type of source (kaggle, csv_url, json_url)
        
        Returns:
            List of records as dictionaries
        """
        if source_type == "kaggle":
            return await self._scrape_kaggle(source_url)
        elif source_type == "csv_url":
            return await self._scrape_csv_url(source_url)
        elif source_type == "json_url":
            return await self._scrape_json_url(source_url)
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
    
    async def _scrape_kaggle(self, dataset_id: str) -> List[Dict[str, Any]]:
        """
        Scrape data from Kaggle dataset
        
        Args:
            dataset_id: Kaggle dataset identifier (e.g., 'vagifa/ethereum-frauddetection-dataset')
        """
        try:
            # Set Kaggle credentials
            os.environ["KAGGLE_USERNAME"] = self.kaggle_username
            os.environ["KAGGLE_KEY"] = self.kaggle_key
            
            from kaggle.api.kaggle_api_extended import KaggleApi
            
            api = KaggleApi()
            api.authenticate()
            
            # Extract dataset identifier from URL if needed
            if "kaggle.com/datasets/" in dataset_id:
                dataset_id = dataset_id.split("kaggle.com/datasets/")[1].split("?")[0]
            
            logger.info(f"Downloading Kaggle dataset: {dataset_id}")
            
            # Download dataset
            api.dataset_download_files(dataset_id, path=str(self.temp_dir), unzip=True)
            
            # Find CSV files
            csv_files = list(self.temp_dir.glob("*.csv"))
            if not csv_files:
                raise FileNotFoundError("No CSV files found in downloaded dataset")
            
            # Read the first CSV file (or combine multiple)
            df = pd.read_csv(csv_files[0])
            logger.info(f"Loaded {len(df)} records from {csv_files[0].name}")
            
            # Convert to list of dicts
            records = df.to_dict(orient="records")
            
            # Cleanup
            for file in csv_files:
                file.unlink()
            
            return records
            
        except Exception as e:
            logger.error(f"Error scraping Kaggle dataset: {e}")
            raise
    
    async def _scrape_csv_url(self, url: str) -> List[Dict[str, Any]]:
        """Scrape data from a CSV URL"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                # Save temporarily
                temp_file = self.temp_dir / "temp_data.csv"
                temp_file.write_bytes(response.content)
                
                # Read CSV
                df = pd.read_csv(temp_file)
                logger.info(f"Loaded {len(df)} records from CSV URL")
                
                # Cleanup
                temp_file.unlink()
                
                return df.to_dict(orient="records")
                
        except Exception as e:
            logger.error(f"Error scraping CSV URL: {e}")
            raise
    
    async def _scrape_json_url(self, url: str) -> List[Dict[str, Any]]:
        """Scrape data from a JSON URL"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                data = response.json()
                
                # Handle different JSON structures
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "data" in data:
                    return data["data"]
                else:
                    return [data]
                    
        except Exception as e:
            logger.error(f"Error scraping JSON URL: {e}")
            raise
