# ConnectTool API Documentation

API documentation for the ConnectTool database. This document covers all available endpoints and their usage.

## Projects

### Create Project
**POST** `/projects`

Request body:
```json
{
  "title": "Project Name",
  "description": "Project description",
}
```

Response (201 Created):
```json
{
  "id": 1,
  "title": "Project Name",
  "description": "Project description",
}
```

### Get All Projects
**GET** `/projects`

Response (200 OK):
```json
[
  {
    "id": 1,
    "title": "Project Name",
    "description": "Project description",
  }
]
```

### Get Project by ID
**GET** `/projects/{id}`

Response (200 OK):
```json
{
  "id": 1,
  "title": "Project Name",
  "description": "Project description",
}
```

### Update Project
**PUT** `/projects/{id}`

Request body:
```json
{
  "title": "Updated Project",
  "description": "Updated description",
}
```

Response (200 OK):
```json
{
  "id": 1,
  "title": "Updated Project",
  "description": "Updated description",
}
```

### Delete Project
**DELETE** `/projects/{id}`

Response (204 No Content)