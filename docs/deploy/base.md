# Foundation

## Overview
DTM can be divided into three roles, application program (AP), resource manager (RM), and transaction manager (TM).
AP and RM are business microservices, with DTM SDK integrated.
Their deployment is done with the business without separate deployment.
On the other hand, DTM needs separate deployment.

This section describes the online deployment.
Refer to [installation](../guide/install) if you only intend to run locally.

Online deployment consists of the following steps: 

1. Create the relevant database tables
2. 
2. Start the dtm container via environment variable setup (recommended)
  - You can also use file-based configuration instead of environment variables (not recommended)
  - You can also choose to compile the dtm and deploy it directly (not recommended)

## Prepare the database tables

### RM table

RM relies on local resource management.
Therefore, subtransaction barrier technology provided by DTM requires the creation of subtransaction barrier-related tables in the local database. 
See [subtransaction barrier table SQL](https://github.com/yedf/dtm/tree/main/dtmcli/barrier.mysql.sql)

### DTM table

DTM plays the TM role.
The global transaction information is stored in the database.
You need to create the relevant tables in the corresponding database, see [DTM Global Transaction Table SQL](https://github.com/yedf/dtm/blob/main/dtmsvr/dtmsvr.mysql.sql) for details of the table building statement.

## DTM configuration

DTM supports both environment variables and file-based configuration.
If there are both environment variables and configuration files, the configuration file has higher priority.

### Environment variables (recommended way)

In order to support containerization and cloud native in a friendly way, DTM supports environment-variable-based configuration

#### Required configuration items

There are three mandatory configuration items, DB_HOST, DB_USER, DB_PASSWORD

##### DB_HOST

The host of the database

##### DB_USER

The user name of the database

##### DB_PASSWORD

The password for the database.

#### Optional configuration items

The optional configuration items have default values

##### DB_DRIVER

The database type. 
The acceptable values are :

- mysql dtm provides good support for mysql
- postgres server-side dtm supports postgres, but dtmcli, as well as the examples, is currently not written to be compatible with postgres for simplicity.
  You are encouraged to check out the postgres branch and play with it.

Default is mysql.

##### DB_PORT

The port of the database.
Default is 3306.

##### CRON_JOB_INTERVAL

Polling interval to check timed-out transactions.
Default is 10, which means dtm will check the timed-out global transactions in the database every 10 seconds.

### yaml-file-based configuration (non-recommended way)

To facilitate direct deployment as well as debugging, DTM also supports yaml-file-based configuration.
Please see the [sample yml configuration file](https://github.com/yedf/dtm/blob/main/conf.sample.yml).

dtm will search for conf.yml and conf.sample.yml, in that order, starting from the working directory and then going up the parent directories.
The search stops at the first match.
