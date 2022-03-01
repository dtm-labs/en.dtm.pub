# Foundation

## Overview

This section describes the online deployment method, if you are only running locally, you can refer to [installation](../guide/start)

The individual participants in the entire distributed transaction of dtm, are divided into three roles, AP, RM, and TM, see the dtm architecture in the guide for details. When you need to bring a distributed transaction application online, you need the following steps.
- Prepare the sub-transaction barrier table used in RM, which needs to be created in your business database
- Prepare the transaction state storage tables used in the DTM server. Only needed when you choose DTM's storage to be DB.
- Design your deployment scenario: The options available include, direct binary deployment, docker deployment, K8S deployment.
- Design your dtm multi-instances solution: Single instance deployment is not recommended for online applications. dtm is the same as a normal stateless application, just multi-instances.
- Configure your dtm server

## Points to note
- ** If the dtm server uses a database, then it must use the primary database, not the replicas. On the one hand dtm is write more read less; on the other hand dtm has high requirements for data consistency, slave library latency can lead to various problems. **

## Preparing RM data tables
RM involves local resource management, so using the subtransaction barrier technology provided by DTM requires the creation of subtransaction barrier-related tables in the local database, see the barrier file in [Build SQL](https://github.com/dtm-labs/dtm/blob/main/sqls/) for details of the table sqls.

## Prepare DTM data table
DTM as TM role, if you choose the database as the storage engine, then the global transaction information will be stored in the database, you need to create the relevant tables in the corresponding database, see [build table SQL](https://github.com/dtm-labs/dtm/blob/main/sqls/) in the storage file for details of the table sqls

## Deployment scheme
This part has more content, see [deploy](./deploy)

## dtm multi-instances solution
Single instance deployments are not recommended for online applications, and dtm is no exception. You will need to do a multi-instance deployment depending on your deployment scenario
- Microservice deployments, such as go-zero, polaris: such microservice protocols, there is already a multi-instances solution, just refer to the specific microservice case
- Binary deployment, Docker deployment, deploy multi-instances DTM like your other stateless services.
- K8S deployment: you can specify the number of replicas directly

You can refer to high availability section of [dtm architecture](../practice/arch) for how to collaborate and avoid problems with multiple instances of dtm.

## DTM Configuration
DTM supports both environment variable and file configuration, if there are both environment variable and file, then the configuration file has high priority

#### Environment variables
To support containerization and cloud-native in a friendly way, DTM supports environment variables for configuration

All configurable options refer to: [yml sample configuration file](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml), for each configuration file in the configuration file, can be set by environment variables, the corresponding rules are as follows.

```
MicroService.EndPoint => MICRO_SERVICE_END_POINT
```

A sample configuration file using mysql is as follows.
``` yml
Store:
  Driver: 'mysql'
  Host: 'localhost'
  User: 'root'
  Password: ''
  Port: 3306
```

For the most detailed configuration instructions, please refer to the above yml sample configuration file with comments for each configuration item

#### yml file configuration
In order to facilitate direct deployment and debugging, DTM also supports yml configuration file, refer to [yml sample configuration file](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml) for detailed configuration items.

When using yml to configure dtm, you need to specify the configuration file by command line, using the following command.

`dtm -c . /conf.sample.yml`
