import logging
from pymongo import ASCENDING, DESCENDING

from data.connect import mongo_db


logger = logging.getLogger(__name__)


def run_migration():
    collection = mongo_db["conversations"]

    result_archived = collection.update_many(
        {"lifecycle_status": {"$exists": False}, "active": False},
        {
            "$set": {
                "lifecycle_status": "archived",
                "archived_at": None,
                "deleted_at": None,
                "purge_after": None,
            }
        },
    )
    result_active = collection.update_many(
        {"lifecycle_status": {"$exists": False}, "$or": [{"active": {"$exists": False}}, {"active": {"$ne": False}}]},
        {
            "$set": {
                "lifecycle_status": "active",
                "active": True,
                "archived_at": None,
                "deleted_at": None,
                "purge_after": None,
            }
        },
    )

    collection.create_index([("user_id", ASCENDING), ("lifecycle_status", ASCENDING), ("timestamp", DESCENDING)])
    collection.create_index([("purge_after", ASCENDING)], expireAfterSeconds=0)

    logger.info(
        "Migration finished: archived_backfill=%s active_backfill=%s",
        result_archived.modified_count,
        result_active.modified_count,
    )
    print(
        f"OK migration: archived_backfill={result_archived.modified_count} active_backfill={result_active.modified_count}"
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
