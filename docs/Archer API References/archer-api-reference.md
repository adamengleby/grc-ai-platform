# Archer REST and Content API Complete Reference Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [RESTful API](#restful-api)
   - [Base URL and Components](#base-url-and-components)
   - [API Segments](#api-segments)
   - [Content Operations](#content-operations)
   - [Metadata Operations](#metadata-operations)
   - [Data Feed Operations](#data-feed-operations)
   - [User Management](#user-management)
   - [Security Events](#security-events)
4. [Content API](#content-api)
5. [OData Support](#odata-support)
6. [Field Types and Input Formats](#field-types-and-input-formats)

---

## Overview

The Archer platform provides two main APIs for integration:

### RESTful API
- Collection of resources organized in functional segments
- Uses JSON format by default (also supports XML)
- Standard HTTP verbs for CRUD operations
- Hypermedia-driven (HATEOAS) with self-descriptive messages

### Content API
- Translation layer that converts Archer metadata and content into logical entities
- Provides simplified access to records as they appear in the UI
- Respects user permissions based on session token

**Important Note**: Base URL changed in release 6.5 from `/RSAArcher/api/` to `/RSAArcher/platformapi/`

---

## Authentication

### Login Endpoint
Creates an Archer session using specified credentials.

**Request:**
```http
POST http://[server]/platformapi/core/security/login
```

**Headers:**
```http
Accept: application/json
Content-Type: application/json
```

**Request Body:**
```json
{
  "InstanceName": "v5.0",
  "Username": "sysadmin",
  "UserDomain": "",
  "Password": "Archer123"
}
```

**Response:**
```json
{
  "SessionToken": "C204E18D0ED58E288533F39C455A36E8"
}
```

### Using Session Token
All subsequent API calls must include the session token in the Authorization header:
```http
Authorization: Archer session-id="[session_token_from_login]"
```

### Logout Endpoint
Terminates the specified session.

**Request:**
```http
POST http://[server]/platformapi/core/security/logout
```

**Request Body:**
```json
{
  "Value": "[session_token_to_logout]"
}
```

**Note:** If Single Sign-on is enabled, you must select "Allow manual bypass" in the Archer Control Panel for the RESTful API to generate session tokens.

---

## RESTful API

### Base URL and Components

**Base URL Pattern:**
```
http://[server]/platformapi/core/[segment]/[resource]
```

### API Call Components

| Component | Description | Example |
|-----------|-------------|---------|
| **Library** | HTTP library for requests | `CreateObject("winHttp.WinHttpRequest.5.1")` |
| **Request** | Opens HTTP request | `MyRequest.Open "POST", "[url]"` |
| **Header** | Request headers | `MyRequest.setRequestHeader "Content-Type", "application/json"` |
| **Body** | Request payload | JSON formatted data |
| **Submission** | Send request | `MyRequest.send requestBody` |
| **Response** | Server response | `MyRequest.ResponseText` |

### API Segments

The RESTful API is divided into the following functional segments:

1. **Authentication** (Security Controller)
2. **Content** (Content Controller)
3. **Metadata** (System Controller)
4. **Data Feed** (Data Feed Controller)
5. **User Management** (System Controller)
6. **Security Events** (Access Control Reports)

---

## Content Operations

### Get Content by ID
Retrieves a content record by specified ID.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/contentid?id=[contentid]
```

**With $select Action:**
```http
POST http://[server]/platformapi/core/content/contentid?id=[contentid]&$select=LastUpdated
```

**Headers:**
```http
Accept: application/json
Authorization: Archer session-id="[token]"
Content-Type: application/json
X-Http-Method-Override: GET
```

### Get Content by Reference Field ID
Retrieves all content records by specified reference field ID.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/referencefield/referencefieldid?id=[referencefieldid]
```

**Supported Actions:**
- `$filter` - Filter results
- `$select` - Select specific fields
- `$top` - Limit number of results
- `$skip` - Skip results
- `$orderby` - Sort results

**Examples:**
```http
# Filter by SequentialId
?id=18501&$filter=SequentialId eq 3

# Select only SequentialId field
?id=18501&$select=SequentialId

# Get top 1 record
?id=18501&$top=1

# Skip first 2 records
?id=18501&$skip=2

# Order by SequentialId
?id=18501&$orderby=SequentialId
```

### Get Content by Content ID and Field ID
Retrieves field content by content ID and field ID.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/fieldcontent
```

**Request Body:**
```json
{
  "FieldIds": [18503, 18504, 18505, 18506, 18507],
  "ContentIds": [184630, 184631, 184632, 184633]
}
```

### Create Content (POST)
Creates a new content record.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content
```

**Request Body Structure:**
```json
{
  "Content": {
    "LevelId": 123,
    "FieldContents": {
      "[FieldId]": {
        "Type": [FieldType],
        "Value": "[Value]",
        "FieldId": [FieldId]
      }
    }
  },
  "SubformFieldId": 123  // Optional
}
```

### Update Content (PUT)
Updates an existing content record.

**Endpoint:**
```http
PUT http://[server]/platformapi/core/content
```

**Request Body:**
```json
{
  "Content": {
    "Id": 123,
    "LevelId": 9,
    "FieldContents": {
      "3204": {
        "Type": 2,
        "Value": 0.0,
        "FieldId": 3204
      },
      "3202": {
        "Type": 4,
        "Value": {
          "ValuesListIds": [2405],
          "OtherText": null
        },
        "FieldId": 3202
      }
    },
    "Version": "44"
  },
  "SubformFieldId": 123  // Optional
}
```

### Delete Content
Deletes a content record by ID.

**Endpoint:**
```http
DELETE http://[server]/platformapi/core/content/[ID]
```

### Attachment Operations

#### Get Attachment
Retrieves an attachment from the Archer file repository.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/attachment/[attachmentid]
```

**Headers:**
```http
X-Http-Method-Override: GET
```

**Response:**
```json
{
  "AttachmentName": "filename.jpg",
  "AttachmentBytes": "[Base64_encoded_string]"
}
```

#### Post Attachment from Bytes
Uploads an attachment using Base64 encoded bytes.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/attachment
```

**Request Body:**
```json
{
  "AttachmentName": "Bodie.jpg",
  "AttachmentBytes": "[Base64_encoded_content]",
  "IsSensitive": true  // Optional, for encryption
}
```

#### Post Attachment from Multipart Form Data
Uploads an attachment using multipart form data.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/multipartattachment
```

**Headers:**
```http
Content-Type: multipart/form-data; boundary=[boundary_string]
```

### History Log Data
Retrieves content history log data.

**Endpoint:**
```http
POST http://[server]/platformapi/core/content/history/[ID]
```

**Headers:**
```http
X-Http-Method-Override: GET
```

### Data Gateway (External Content Change Notification)
Notifies Archer when content changes in external systems.

**Endpoint:**
```http
PUT http://[server]/platformapi/core/content/externalContentChangeNotification
```

**Request Body:**
```json
{
  "Alias": "ARCHER",
  "ContentPartIds": ["234811"],
  "ExternalFieldIds": ["19649"]
}
```

---

## Metadata Operations

### Application Resources

#### Get Application by ID
```http
GET /platformapi/core/system/application/[applicationid]
```

#### Get All Applications
```http
GET /platformapi/core/system/application
```

#### Get Application Version
```http
GET /platformapi/core/system/applicationinfo/version
```

### Field Definition Resources

#### Get Field Definition by ID
```http
GET /platformapi/core/system/fielddefinition/[fieldid]
```

#### Get Field Definitions by Application ID
```http
GET /platformapi/core/system/fielddefinition/application/[applicationid]
```

#### Get Field Definitions by Level
```http
GET /platformapi/core/system/fielddefinition/level/[levelid]
```

#### Get Values List Field Definitions by Level
```http
GET /platformapi/core/system/fielddefinition/level/[levelid]/valueslist
```

### Level Resources

#### Get Level by ID
```http
GET /platformapi/core/system/level/[levelid]
```

#### Get Levels by Module
```http
GET /platformapi/core/system/level/module/[moduleid]
```

#### Get Levels by Reference Field
```http
GET /platformapi/core/system/level/referencefield/[fieldid]
```

#### Get All Levels
```http
GET /platformapi/core/system/level
```

#### Get Level Layout
```http
GET /platformapi/core/system/levellayout/[levelid]
```

### Questionnaire Resources

#### Get Questionnaire by ID
```http
GET /platformapi/core/system/questionnaire/[questionnaireid]
```

#### Get All Questionnaires
```http
GET /platformapi/core/system/questionnaire
```

### Values List Resources

#### Get Values List Definition by ID
```http
GET /platformapi/core/system/valueslist/[id]
```

#### Get Values List Values (Flat)
```http
GET /platformapi/core/system/valueslistvalue/flat/valueslist/[valueslistid]
```

#### Get Values List Values (Hierarchical)
```http
GET /platformapi/core/system/valueslistvalue/valueslist/[valueslistid]
```

### Security Parameter Resources

#### Get Security Parameter by ID
```http
GET /platformapi/core/system/securityparameter/[securityparameterid]
```

#### Get All Security Parameters
```http
GET /platformapi/core/system/securityparameter
```

#### Create Security Parameter
```http
POST /platformapi/core/system/securityparameter
```

#### Update Security Parameter
```http
PUT /platformapi/core/system/securityparameter
```

#### Delete Security Parameter
```http
DELETE /platformapi/core/system/securityparameter/[securityparameterid]
```

---

## Data Feed Operations

### Execute Data Feed
Runs a data feed and optionally any referenced feeds.

**Endpoint:**
```http
POST http://[server]/platformapi/core/datafeed/execution
```

**Request Body:**
```json
{
  "DataFeedGuid": "4685367E-E76E-4580-BDEC-83E98FF48A50",
  "IsReferenceFeedsIncluded": false
}
```

### Get History Message
Retrieves history message for a specific history ID.

**Endpoint:**
```http
POST http://[server]/platformapi/core/datafeed/historymessage/[historyId]
```

**Headers:**
```http
X-Http-Method-Override: GET
```

### Get Recent Run Detail
Retrieves history for the most recent data feed run.

**Endpoint:**
```http
POST http://[server]/platformapi/core/datafeed/history/recent
```

**Request Body:**
```json
{
  "Guid": "4685367E-E76E-4580-BDEC-83E98FF48A50"
}
```

**Data Feed Status Codes:**
| Code | Status |
|------|--------|
| 1 | Running |
| 2 | Completed |
| 3 | Faulted |
| 4 | Warning |
| 5 | Terminating |
| 6 | Terminated |
| 7 | Pending |

### Get Run History
Retrieves complete history for a data feed.

**Endpoint:**
```http
POST http://[server]/platformapi/core/datafeed/history
```

**Request Body:**
```json
{
  "Guid": "4685367E-E76E-4580-BDEC-83E98FF48A50"
}
```

---

## User Management

### User Operations

#### Get User by ID
```http
GET /platformapi/core/system/user/[userid]
```

#### Get Users by Group
```http
GET /platformapi/core/system/user/group/[groupid]
```

#### Get All Users
```http
GET /platformapi/core/system/user
```

#### Create User
```http
POST /platformapi/core/system/user
```

#### Update User
```http
PUT /platformapi/core/system/user
```

#### Delete User
```http
DELETE /platformapi/core/system/user/[userid]
```

#### Activate User
```http
POST /platformapi/core/system/user/status/active/[userid]
```

#### Deactivate User
```http
POST /platformapi/core/system/user/status/inactive/[userid]
```

#### Change User Password
```http
POST /platformapi/core/system/userpassword
```

#### Add User to Group
```http
POST /platformapi/core/system/usergroup
```

#### Remove User from Group
```http
DELETE /platformapi/core/system/usergroup
```

#### Add User to Role
```http
POST /platformapi/core/system/userrole
```

#### Remove User from Role
```http
DELETE /platformapi/core/system/userrole
```

#### Get User Contacts
```http
GET /platformapi/core/system/usercontact
```

#### Get User Contacts by User ID
```http
GET /platformapi/core/system/usercontact/[userid]
```

### Group Operations

#### Get Group by ID
```http
GET /platformapi/core/system/group/[groupid]
```

#### Get Groups by User
```http
GET /platformapi/core/system/group/user/[userid]
```

#### Get All Groups
```http
GET /platformapi/core/system/group
```

#### Get Group Hierarchy
```http
GET /platformapi/core/system/grouphierarchy
```

#### Create Group
```http
POST /platformapi/core/system/group
```

#### Update Group
```http
PUT /platformapi/core/system/group
```

#### Delete Group
```http
DELETE /platformapi/core/system/group/[groupid]
```

#### Get Group Membership
```http
GET /platformapi/core/system/groupmembership
```

#### Add Group Member
```http
POST /platformapi/core/system/groupmember
```

#### Remove Group Member
```http
DELETE /platformapi/core/system/groupmember
```

#### Add Group to Role
```http
POST /platformapi/core/system/rolegroup
```

#### Remove Group from Role
```http
DELETE /platformapi/core/system/rolegroup
```

### Role Operations

#### Get All Roles
```http
GET /platformapi/core/system/role
```

#### Get Roles by User ID
```http
GET /platformapi/core/system/role/user/[userid]
```

#### Get Role Memberships
```http
GET /platformapi/core/system/role
```

#### Create Role
```http
POST /platformapi/core/system/role
```

#### Update Role
```http
PUT /platformapi/core/system/role
```

#### Delete Role
```http
DELETE /platformapi/core/system/role/[roleid]
```

### Task Operations

#### Get User Tasks
```http
GET /platformapi/core/system/task
```

**Note:** Supports `$filter` for IsComplete property only.

---

## Security Events

### Security Events Report API
Returns security events for a specified date.

**Endpoint:**
```http
POST http://[server]/api/core/system/AccessControlReports/SecurityEvents
```

**Request Body:**
```json
{
  "InstanceName": "Archer",
  "EventType": "all events",
  "EventsForDate": "2021-06-17"
}
```

**Headers:**
```http
Content-Type: application/json
Authorization: Archer session-id="[token]"
X-Http-Method-Override: GET
```

**Pagination:**
- Supports pagination via `page` query parameter
- Each page returns maximum 50,000 events
- Example: `?page=1`, `?page=2`, etc.

**Requirements:**
- Read privileges to Security Events Report (under Access Control Reports)
- Date range: 1-6 days before current date
- Format: YYYY-MM-DD

---

## Content API

The Content API provides simplified access to Archer content as logical entities.

### Key Features:
- Translation layer between raw metadata/content and UI representation
- Respects user permissions based on session token
- Cannot update records with identical values (returns HTTP 400)

### Supported Field Types:
The Content API supports the same field types as the RESTful API but presents them in a more user-friendly format aligned with the UI representation.

---

## OData Support

### Supported OData Operations

#### Projecting ($select)
Select specific properties in the response.
```json
{"Value": "?$select=Name,Description"}
```

#### Sorting ($orderby)
Sort results by a property.
```json
{"Value": "?$orderby=boo desc"}
```

#### Paging ($top and $skip)
Implement pagination in results.
```json
{"Value": "?$top=50&$skip=100"}
```

### OData Support by Resource Type

#### Metadata Resources
- Full support for `$select`, `$orderby`, `$top`, `$skip`
- Properties available for filtering:
  - Id
  - LevelId
  - Type
  - Name
  - Alias
  - IsActive
  - Guid
  - ASOStatus
  - SystemType
  - IsPrivate
  - IsContentReadOnly
  - EsFieldMappingId
  - UpdateInformation
  - FieldMap

#### Content Resources
- Limited support for projecting within collections
- Full support for `$top`, `$skip`, `$orderby` when retrieving content by reference field

---

## Field Types and Input Formats

### Field Type Mapping

| Type Value | Field Type | Description |
|------------|------------|-------------|
| 1 | Text | Single Line Text, Text Area (HTML) |
| 2 | Numeric | Numeric values |
| 3 | Date | Date Only, Date and Time |
| 4 | Values List | Dropdown/Multi-select lists |
| 7 | External Links | URL references |
| 8 | Users/Groups List | User/Group selections, Record Permissions |
| 9 | Cross-Reference | References to other records |
| 11 | Attachment | File attachments |
| 12 | Image | Image files |
| 16 | Matrix | Matrix field |
| 19 | IP Address | IPv4/IPv6 addresses |
| 23 | Related Records | Related record references |
| 24 | Sub-Form | Embedded sub-forms |

### Input Format Examples

#### Text Field (Type 1)
```json
{
  "Type": 1,
  "Tag": "Description",
  "Value": "Sample text content",
  "FieldId": 9402
}
```

#### HTML Text Field (Type 1)
```json
{
  "Type": 1,
  "Tag": "Address",
  "Value": "<p>1234 Main Street<br>Anytown, AA 12345</p>",
  "FieldId": 9403
}
```

#### Numeric Field (Type 2)
```json
{
  "Type": 2,
  "Tag": "Amount",
  "Value": 123450.6789,
  "FieldId": 1234
}
```

#### Date Field (Type 3)
```json
{
  "Type": 3,
  "Tag": "Date with Time",
  "Value": "10/21/1956 11:59AM",
  "FieldId": 123451
}
```

#### Date Only (Type 3)
```json
{
  "Type": 3,
  "Tag": "Birth Date",
  "Value": "12/27/2016",
  "FieldId": 123452
}
```

#### Null Date (Type 3)
```json
{
  "Type": 3,
  "Tag": "Null Date",
  "Value": "0",
  "FieldId": 123453
}
```

#### Values List (Type 4)
```json
{
  "Type": 4,
  "Tag": "Severity",
  "Value": {
    "ValuesListIds": [2, 3, 4],
    "OtherText": "Custom Value"
  },
  "FieldId": 34564
}
```

#### Null Values List (Type 4)
```json
{
  "Type": 4,
  "Tag": "Null Values List",
  "Value": {0},
  "FieldId": 34563
}
```

#### External Links (Type 7)
```json
{
  "Type": 7,
  "Tag": "References",
  "Value": [
    {
      "Name": "Archer",
      "URL": "https://www.archerirm.com"
    },
    {
      "Name": "Archer Community",
      "URL": "https://www.archerirm.community/"
    }
  ],
  "FieldId": 11234
}
```

#### Users/Groups List (Type 8)
```json
{
  "Type": 8,
  "Tag": "Assignees",
  "Value": {
    "UserList": [
      {"ID": 19},
      {"ID": 20}
    ],
    "GroupList": [
      {"ID": 1}
    ]
  },
  "FieldId": 12234
}
```

#### Record Permissions (Type 8)
```json
{
  "Type": 8,
  "Tag": "Permissions",
  "Value": {
    "UserList": [
      {"ID": 190},
      {"ID": 191}
    ],
    "GroupList": [
      {"ID": 19}
    ]
  },
  "FieldId": 13877
}
```

#### Cross-Reference (Type 9)
```json
{
  "Type": 9,
  "Tag": "Related Items",
  "Value": [
    {"ContentID": 205522},
    {"ContentID": 205643},
    {"ContentID": 205783}
  ],
  "FieldId": 12234
}
```

#### Attachment (Type 11)
```json
{
  "Type": 11,
  "Tag": "Documents",
  "Value": [1234],
  "FieldId": 12334
}
```
*Note: Value is the Attachment ID returned by Post Attachment operations*

#### Image (Type 12)
```json
{
  "Type": 12,
  "Tag": "Screenshot",
  "Value": [2234],
  "FieldId": 12334
}
```
*Note: Images are handled like attachments but with Type 12*

#### Matrix (Type 16)
```json
{
  "Type": 16,
  "Tag": "Risk Matrix",
  "Value": [
    {
      "RowId": 63800,
      "ColumnId": 63823
    }
  ],
  "FieldId": 15674
}
```

#### IP Address (Type 19)
```json
{
  "Type": 19,
  "IpAddressBytes": "127.0.0.1",
  "FieldId": 12334
}
```
*Note: Do not include additional fields or the input will fail*

#### Related Records (Type 23)
```json
{
  "Type": 23,
  "Tag": "Dependencies",
  "Value": [345155, 234512],
  "FieldId": 18975
}
```
*Note: Values are Content IDs of related records*

#### Sub-Form (Type 24)
```json
{
  "Type": 24,
  "Tag": "Line Items",
  "Value": [345155],
  "FieldId": 18975
}
```
*Note: Values are Content IDs of sub-form records*

---

## Important Notes and Best Practices

### General Guidelines
1. **Base URL Change**: Always use `/platformapi/` instead of the deprecated `/api/` path
2. **Session Management**: Store and reuse session tokens; implement proper logout
3. **Content-Type**: Always specify `application/json` unless using multipart form data
4. **Method Override**: Use `X-Http-Method-Override: GET` for GET operations via POST
5. **Validation**: Invalid inputs may be silently ignored despite successful API responses
6. **Tags**: Use optional "Tag" fields for documentation and debugging
7. **Null Values**: Different field types have specific null value representations

### Performance Considerations
1. **Pagination**: Use `$top` and `$skip` for large result sets
2. **Server-side Page Size**: Configure maximum page size to prevent resource exhaustion
3. **Field Selection**: Use `$select` to retrieve only necessary fields
4. **Bulk Operations**: Use batch endpoints when available

### Security Considerations
1. **Authentication**: Always use HTTPS in production
2. **Session Tokens**: Treat as sensitive credentials
3. **SSO Compatibility**: Enable "Allow manual bypass" for API access with SSO
4. **Permissions**: API respects user permissions; ensure proper access control
5. **Sensitive Data**: Use `IsSensitive` flag for encrypted attachment storage

### Error Handling
1. **HTTP Status Codes**: Check response codes for operation success
2. **Validation Messages**: Parse `ValidationMessages` in response for error details
3. **Locked Records**: Be aware that APIs can update locked records
4. **Content Updates**: Cannot update records with identical values (HTTP 400)

### Determining IDs
1. **Application GUID**: Found in Manage Applications > General Information > ID field
2. **Field IDs**: Hover over field names in the Fields tab to see IDs
3. **System IDs**: Use metadata endpoints to discover available IDs programmatically

---

## Response Format Examples

### Successful Response
```json
{
  "Links": [],
  "RequestedObject": {
    "Id": 123454
  },
  "IsSuccessful": true,
  "ValidationMessages": []
}
```

### Failed Response
```json
{
  "Links": [],
  "RequestedObject": null,
  "IsSuccessful": false,
  "ValidationMessages": [
    {
      "MessageKey": "InvalidParameter",
      "Message": "The parameter 'EventType' has an invalid value"
    }
  ]
}
```

### Collection Response (Applications Example)
```json
[
  {
    "Links": [],
    "RequestedObject": {
      "Name": "Risk Register",
      "KeepLicensed": false,
      "IsDeprecated": false,
      "Description": "Central repository for risk information"
    },
    "IsSuccessful": true,
    "ValidationMessages": []
  },
  {
    "Links": [],
    "RequestedObject": {
      "Name": "Controls",
      "Description": "Control management application"
    },
    "IsSuccessful": true,
    "ValidationMessages": []
  }
]
```

---

## Quick Reference - Common Operations

### 1. Authenticate and Get Session Token
```http
POST /platformapi/core/security/login
Body: {"InstanceName":"[instance]","Username":"[user]","Password":"[pass]"}
```

### 2. Get All Applications
```http
GET /platformapi/core/system/application
Header: Authorization: Archer session-id="[token]"
```

### 3. Get Fields for an Application
```http
GET /platformapi/core/system/fielddefinition/application/[appId]
```

### 4. Create a New Record
```http
POST /platformapi/core/content
Body: {"Content":{"LevelId":[id],"FieldContents":{...}}}
```

### 5. Update an Existing Record
```http
PUT /platformapi/core/content
Body: {"Content":{"Id":[id],"LevelId":[id],"FieldContents":{...},"Version":"[version]"}}
```

### 6. Search Records by Reference Field
```http
POST /platformapi/core/content/referencefield/referencefieldid?id=[fieldId]&$filter=[condition]
```

### 7. Upload an Attachment
```http
POST /platformapi/core/content/attachment
Body: {"AttachmentName":"[name]","AttachmentBytes":"[base64]","IsSensitive":false}
```

### 8. Execute a Data Feed
```http
POST /platformapi/core/datafeed/execution
Body: {"DataFeedGuid":"[guid]","IsReferenceFeedsIncluded":false}
```

### 9. Get User Information
```http
GET /platformapi/core/system/user/[userId]
```

### 10. Logout
```http
POST /platformapi/core/security/logout
Body: {"Value":"[session_token]"}
```

---

## Version History and Notes

- **Version 6.5+**: Base URL changed from `/RSAArcher/api/` to `/RSAArcher/platformapi/`
- **Content API**: Cannot update records with same values (HTTP 400 error)
- **SSO Compatibility**: Requires "Allow manual bypass" for RESTful API token generation
- **Security Events API**: Supports events from 1-6 days in the past
- **Pagination**: Maximum 50,000 records per page for Security Events

---

*This reference guide is based on Archer API documentation version 2024_11*