import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.core.config import get_settings

async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_atlas_uri, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]
    coll = db[settings.mongodb_collection_name]
    count = await coll.count_documents({})
    print(f"=== MONGODB ATLAS VERIFICATION ===")
    print(f"Database:   {settings.mongodb_db_name}")
    print(f"Collection: {settings.mongodb_collection_name}")
    print(f"Total Stored Moments: {count}")
    
    docs = await coll.find({}).sort("created_at", -1).to_list(10)
    for i, doc in enumerate(docs, 1):
        print(f"\n[{i}] ID: {doc.get('id')}")
        print(f"    Timestamp:   {doc.get('created_at')}")
        print(f"    Type:        {doc.get('classification')}")
        print(f"    Confidence:  {doc.get('confidence')}")
        print(f"    Caption:     {doc.get('caption')}")
        print(f"    Tags:        {doc.get('mood_tags')}")
        print(f"    Cloudinary:  {doc.get('image_url')}")
        embedding = doc.get("embedding", [])
        print(f"    Vector Dims: {len(embedding)} dimensions (Vector Search ready)")

if __name__ == "__main__":
    asyncio.run(main())
