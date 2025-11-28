# MongoDB Docker Setup

## Starting MongoDB

Run MongoDB using Docker Compose:

```bash
docker-compose up -d
```

To stop MongoDB:

```bash
docker-compose down
```

To stop and remove all data:

```bash
docker-compose down -v
```

## Connecting Your App

Update your `.env` file with the MongoDB connection string:

```env
MONGODB_URI=mongodb://admin:admin123@localhost:27017/b2b-membership?authSource=admin
```

## Connecting with MongoDB Compass

1. Open MongoDB Compass
2. Use this connection string:

```
mongodb://admin:admin123@localhost:27017/?authSource=admin
```

Or fill in the connection form manually:

-   **Host**: localhost
-   **Port**: 27017
-   **Authentication**: Username/Password
-   **Username**: admin
-   **Password**: admin123
-   **Authentication Database**: admin

3. Click "Connect"
4. Your database `b2b-membership` will appear in the list

## Checking MongoDB Status

Check if MongoDB is running:

```bash
docker ps
```

View MongoDB logs:

```bash
docker logs b2b-membership-mongodb
```

## Default Credentials

-   **Username**: admin
-   **Password**: admin123
-   **Database**: b2b-membership
-   **Port**: 27017

**Note**: Change these credentials in production!
