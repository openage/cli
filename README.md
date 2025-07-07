# OA Command Line Interface

A CLI tool for managing workspace resources with commands for pulling, pushing, and managing sessions.

## Quick Start

### First-time setup

```bash
oa --host console.domain.com --env prod
```
It would prompt you to login

### Common operations

```bash
# Pull specific resource
oa pull get://system/navs/home   
# Push changes 
oa push system/navs/home.json 
# Run a script (in .scripts folder)
oa builk            
```

## Workspace Structure

The workspace contains:
- `.cache` - Temporary files
- `.logs` - Operation logs
- `.settings` - Configuration
- `.scripts` - Custom scripts

## Core Commands

### pull

Here are the supported variations:

```bash
# by target folder
oa pull system/navs/docs   
# explicit target folder                  
oa pull folder://system/navs/docs   
# by target file        
oa pull system/navs/docs/home.json  
# explicit target file        
oa pull file://system/navs/docs/home.json  
# by source
oa pull get://system/navs/home?application-code=docs     
oa pull search://system/navs?application-code=docs       
# by source and target
oa pull get://system/navs/home?application-code=docs system/navs/docs/home.json
oa pull search://system/navs?application-code=docs system/navs/docs
```

- If only one parameter is provided can be **source** or **target**.
- If the **source** is not specified, it is fetched from the meta in `.oa` folder.
- If the **target** is not specified, it is inferred from the source.
- In case both of them are provided, first one needs to be **source** and the second one needs to be **target**

#### all items
It can be used pull all the items from remote to the local folder. Lets assume there is a folder `docs-nav` where you want to pull all the navs for the applicaiton `docs` from api `navs` in service `system`. It needs to have folder `.oa` where there should be the meta file `remote.json`. Here is the sample meta file

```json
{
  "service": "system",
  "collection": "navs",
  "query": {
    "application-code": "docs"
  }
}
```
To do this you need run following command
```bash
oa pull docs-nav
```
Here is how it works
1. gets the remote source config from the meta file `docs-nav/.oa/remote.json`. 
2. fetches the list of items from the source
3. for each item creates/updates
   - the data file `docs-nav/{{id}}.json` 
   - the meta file `docs-nav/.oa/{{id}}.json`

#### single item
For a single item, you need to specify the file path (e.g. `system/navs/home.json`) where you need to save the data. It also needs the remote source from meta file by same name in folder `.oa`. Here is the sample meta file

```json
{
  "service": "system",
  "collection": "navs",
  "id": "home"
}
```
To do this you need run following command
```bash
oa pull system/navs/home.json 
```
Here is how it works
1. gets the remote source config from the meta file `system/navs/.oa/home.json`. 
2. fetches the data from the source
3. updates 
   - the data file `system/navs/home.json`
   - the meta file `system/rorolesTypesles/.oa/home.json`

### push

Here are the supported variations:

```bash
oa push system/navs/docs/home.json
oa push file:system/navs/docs/home.json
oa push system/navs/docs
oa push folder://system/navs/docs
oa push system/navs/docs/home.json update://system/navs/home?application-code=docs
oa push system/navs/docs create://system/navs?application-code=docs
```
- The first parmeter is **source**
- The second paramter is the **target** and is optional. If is not specified, it is fetched from `.oa/remote.json`.


The push works exactly like pull

#### single item
Run following command to push a file to remote
```bash
oa push system/navs/home.json 
# or
oa push file://system/navs/home.json 
```

Here is how it works
1. gets the remote target config from the meta file `system/navs/.oa/home.json`. 
2. gets the data from the file `system/navs/.oa/home.json`. 
3. updates the remote target

#### all items
Run following command to push a all the files in a folder to remote

```bash
oa push system/navs 
```

### script
Executes operation scripts:
```bash
oa script .scripts/bulk.json
```

This is shorthand and assumes a file `bulk.json` exists in `.scripts` folder

```bash
oa bulk
```


Script format example:
```JSON
{
    "items": [{
        "type": "pull",
        "config": {
            "remote": "search://system/applications"
        }
    }]
}
```

## Common Workflows

### Configuration Management

- Pull config
```bash
oa pull get://system/navs/home
```
- Edit locally
- Push changes
```bash
oa push system/navs/home.json
```

### Environment Promotion
```bash
# Dev environment
oa --host console.domain.com --env dev
oa pull get://system/navs/home

# Prod environment
oa --host console.domain.com --env prod
oa push system/navs/home.json
```

## Build Instructions

Prerequisites: Node.js 16+, pkg package

```bash
# Install pkg
npm install -g pkg

# Build for specific platform
node build.js --platform win --architecture x64

# Build for all platforms
node build.js --platform all
```

Build outputs:
- Windows: `../../builds/oa.exe`
- Unix: `/usr/local/bin/oa`

