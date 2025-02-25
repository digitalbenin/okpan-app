# Data Connection tool API Documentation

API documentation for the data connection tool. This document covers all available endpoints and their usage.

## Projects

### Get All Projects

**GET** `/projects`

Response (200 OK):

```json
[
  {
    "id": 1,
    "title": "Project Name",
    "description": "Project description",
    "date_created": "2021-09-01T12:00:00Z"
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
  "date_created": "2021-09-01T12:00:00Z"
}
```

### Get All Institutions

#### Filters

`project_id`

**GET** `/institutions`

Response (200 OK):

```json
[
  {
    "id": 1,
    "name": "Institution Name",
    "description": "Institution description",
    "country": "Country",
    "location": "City",
    "lon": 40.3453,
    "lat": 8.08098,
    "website": "https://example.com",
    "links": {
      "twitter": "https://twitter.com/institution"
    },
    "project_id": 1,
    "logo": "logo.png",
    "objects_count": 10,
    "assets_count": 8,
    "data_sources_count": 1,
    "status": "in progress"
  }
]
```

### Get Institution by ID

**GET** `/institutions/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "name": "Institution Name",
  "description": "Institution description",
  "country": "Country",
  "location": "City",
  "lon": 40.3453,
  "lat": 8.08098,
  "website": "https://example.com",
  "links": {
    "twitter": "https://twitter.com/institution"
  },
  "project_id": 1,
  "logo": "logo.png",
  "status": "in progress",
  "objects_count": 10,
  "assets_count": 8,
  "data_sources_count": 5
}
```

## Objects

#### Filters

`project_id`, `institution_id`

### Get All Objects

**GET** `/objects`

Response (200 OK):

```json
[
  {
    "id": 1,
    "status": "completed",
    "institution_id": 1,
    "assets": [
      {
        "id": 1,
        "filename": "asset.jpg",
        "path": "/assets/images",
        "type": "image",
        "properties": {
          "size": "1024x768",
          "format": "jpg"
        }
      }
    ],
    "research_fields": [
      {
        "id": 1,
        "name": "Field Name",
        "values": [
          { "id": 1, "value": "Field Value" },
          { "id": 2, "value": "Field Value 2" }
        ]
      }
    ]
  }
]
```

### Get Object by ID

**GET** `/objects/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "status": "completed",
  "institution_id": 1,
  "assets": [
    {
      "id": 1,
      "filename": "asset.jpg",
      "path": "/assets/images",
      "type": "image",
      "properties": {
        "size": "1024x768",
        "format": "jpg"
      }
    }
  ],
  "research_fields": [
    {
      "id": 1,
      "name": "Field Name",
      "values": [
        { "id": 1, "value": "Field Value" },
        { "id": 2, "value": "Field Value 2" }
      ]
    }
  ],
  "data_sources": [
    {
      "id": 1,
      "name": "Data Source",
      "language": "en",
      "copyright": "Data Source copyright",
      "method": "Data Source method",
      "date": "2021-09-01T12:00:00Z",
      "fields": [
        {
          "id": 1,
          "name": "Field Name",
          "value": "Field Value",
          "ontology_fields": [
            { "id": 1, "name": "Ontology Field", "value": "Ontology Value" }
          ],
          "primary": true
        }
      ]
    }
  ]
}
```

## Assets

### Get All Assets

#### Filters

`project_id`, `institution_id`

**GET** `/assets`

Response (200 OK):

```json
[
  {
    "id": 1,
    "filename": "asset.jpg",
    "path": "/assets/images",
    "type": "image",
    "properties": {
      "size": "1024x768",
      "format": "jpg"
    },
    "objects": [
      {
        "id": 1,
        "institution_id": 1
      }
    ]
  }
]
```

### Get Asset by ID

**GET** `/assets/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "filename": "asset.jpg",
  "path": "/assets/images",
  "type": "image",
  "properties": {
    "size": "1024x768",
    "format": "jpg"
  },
  "objects": [
    {
      "id": 1,
      "institution_id": 1
    }
  ]
}
```

## Research Fields

### Get All Research Fields

#### Filters

`project_id`

**GET** `/research-fields`

Response (200 OK):

```json
[
  {
    "id": 1,
    "name": "Field Name",
    "type": "Field Type",
    "description": "Field description",
    "project_id": 1,
    "fields": [
      {
        "id": 1,
        "value": "Field Value",
        "description": "Field Value description",
        "main_asset": {
          "id": 1,
          "filename": "asset.jpg",
          "path": "/assets/images",
          "type": "image",
          "properties": {
            "size": "1024x768",
            "format": "jpg"
          }
        },
        "assets": [
          {
            "id": 1,
            "filename": "asset.jpg",
            "path": "/assets/images",
            "type": "image",
            "properties": {
              "size": "1024x768",
              "format": "jpg"
            }
          }
        ]
      }
    ]
  }
]
```

### Get Research Field by ID

**GET** `/research-fields/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "name": "Field Name",
  "type": "Field Type",
  "description": "Field description",
  "project_id": 1,
  "fields": [
    {
      "id": 1,
      "value": "Field Value",
      "description": "Field Value description",
      "main_asset": {
        "id": 1,
        "filename": "asset.jpg",
        "path": "/assets/images",
        "type": "image",
        "properties": {
          "size": "1024x768",
          "format": "jpg"
        }
      },
      "assets": [
        {
          "id": 1,
          "filename": "asset.jpg",
          "path": "/assets/images",
          "type": "image",
          "properties": {
            "size": "1024x768",
            "format": "jpg"
          }
        }
      ]
    }
  ]
}
```

## Datasources

### Get All Datasources

#### Filters

`project_id`, `institution_id`

**GET** `/datasources`

Response (200 OK):

```json
[
  {
    "id": 1,
    "name": "Data Source",
    "language": "en",
    "copyright": "Data Source copyright",
    "method": "Data Source method",
    "date": "2021-09-01T12:00:00Z",
    "objects_count": 10
  }
]
```

### Get Datasource by ID

**GET** `/datasources/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "name": "Data Source",
  "language": "en",
  "copyright": "Data Source copyright",
  "method": "Data Source method",
  "date": "2021-09-01T12:00:00Z",
  "objects": [{ "id": 1, "image": "image.jpg" }]
}
```

## Ontology

### Get Ontology

**GET** `/ontology`

Response (200 OK):

```json
[
  {
    "id": 1,
    "name": "Field Name",
    "description": "Field Description",
    "category": "Field Category",
    "embedding": []
  }
]
```

### Get Ontology field

**GET** `/ontology/{id}`

Response (200 OK):

```json
{
  "id": 1,
  "name": "Field Name",
  "description": "Field Description",
  "category": "Field Category",
  "embedding": []
}
```

## Settings

### Get All Settings

#### Filters

`project_id`

**GET** `/settings`

Response (200 OK):

```json
{
  "username": "user123",
  "password": "pass123",
  "db_name": "db_name",
  "sync_url": "https://sync.example.com",
  "sig_server": "https://sig.example.com",
  "project_id": 1
}
```

## Embeddings

### Compute Embeddings

**POST** `/embeddings`

Request body:

```json
{
  "value": "String value"
}
```

Response (201 Created):

```json
{
  "embedding": []
}
```

### Compute Embeddings similarity for ontology

**POST** `/ontology/similarity`

Request body:

```json
{
  "embedding": []
}
```

Response (201 Created):

```json
[
  {
    "id": 1,
    "name": "Field Name",
    "description": "Field Description",
    "category": "Field Category",
    "embedding": [],
    "score": 0.8
  }
]
```

### Facets?
