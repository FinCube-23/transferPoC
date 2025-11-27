from enum import unique
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional,Dict,Any
import logging
from datetime import datetime

logger=logging.getLogger(__name__)


class MongoDBService:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        database: str,
        collection: str
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.database_name = database
        self.collection_name = collection
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.collection = None

    async def connect(self):
        try:
            connection_string= f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/?authSource=admin"
            self.client=AsyncIOMotorClient(connection_string)
            self.db=self.client[self.database_name]
            self.collection=self.db[self.collection_name]

            # Test connection
            await self.client.admin.command("ping")
            logger.info(f"Connected to MongoDB at {self.host}:{self.port}")

            # Create index on user_ref_number for faster queries
            await self.collection.create_index("user_ref_number",unique=True)
            logger.info("Created index on user_ref_number")

        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    async def get_score(
        self,
        user_ref_number:str
    ) -> Optional[Dict[str,Any]]:
        """
            Get user score by reference number
            
            Args:
                user_ref_number: User reference number
            
            Returns:
                Document with score or None if not found
        """
        try:
            document=await self.collection.find_one({"user_ref_number":user_ref_number})
            return document
        except Exception as e:
            logger.error(f"Error getting score for {user_ref_number}: {e}")
            return None

    async def update_score(
        self,
        user_ref_number:str,
        confidance:str,
        is_fraud:bool
    )->bool:
        """
            Update user score based on fraud detection result
            
            Score calculation:
            - Fraud: add confidence value (clamped to max 1.0)
            - Not Fraud: subtract confidence value (clamped to min 0.0)
            
            Args:
                user_ref_number: User reference number
                confidence: Confidence value from fraud detection (0-1)
                is_fraud: True if fraud detected, False otherwise
            
            Returns:
                True if successful, False otherwise
        """

        s_val=0.1
        try:
            # Get current score or default to  0
            current_doc=await self.get_score(user_ref_number)
            current_score=current_doc.get("score",0.0) if current_doc else 0.0

            if is_fraud:
                new_score=min(1.0,current_score+(confidance*s_val))
            else:
                new_score=max(0.0,current_score-(confidance*s_val))
            
            # update or insert document
            document={
                "user_ref_number":user_ref_number,
                "score":new_score,
                "updated_at":datetime.utcnow(),
                "last_confidance":confidance,
                "last_result":"fraud" if is_fraud else "not_fraud"
            }

            if current_doc:
                document["created_at"] = current_doc.get("created_at", datetime.utcnow())
            else:
                document["created_at"] = datetime.utcnow()

            await self.collection.update_one(
                {"user_ref_number":user_ref_number},
                {"$set":document},
                upsert=True
            )

            logger.info(f"Updated score for {user_ref_number}: {current_score} -> {new_score}")
            return True

        except Exception as e:
            logger.error(f"Error updating score for {user_ref_number}: {e}")
            return False