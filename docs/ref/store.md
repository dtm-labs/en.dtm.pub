# Storage Engines

dtm supports saving the status and progress of global transactions to three types of storage: relational database (mysql/postgres), Redis, and boltdb, which are suitable for different scenarios, as described below

## Relational databases
Almost every company in the internet, stores data in relational databases, therefore dtm first supported relational database storage, including.
- Mysql series: Mysql, MariaDB, TiDB
- Postgress
Refer to the Store.Driver: "mysql" section in [conf.sample.yml](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml) for detailed configuration

Using a relational database for storage, the [performance test report](../other/performance) shows that a 26K IOPS disk Mysql database can provide 900+ transactions per second, which is sufficient for most companies' distributed transaction needs.

If this is not enough performance, we recommend that you consider the following Redis storage solution

## Redis
Redis is a very widely used caching system that is offered by almost every cloud vendor and deployed by almost every company. dtm supports the storage of global transaction progress to Redis, providing ultra-high performance distributed transaction services.

Since dtm needs to look up expired global transactions in time order, dtm's Redis storage does not support slicing the load onto different slots (PS: distributed transaction frameworks such as seata, again, do not support this either).

Various companies may have purchased a clustered version of the Redis service, can dtm store the data to the clustered version of Redis?A: Yes, by default dtm will specify a prefix to store all data to a single slot.

Refer to the Store.Driver: "redis" section in [conf.sample.yml](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml) for detailed configuration

Using Redis for storage, very high performance can be achieved, with an estimated 10K transactions per second. Detailed performance report can be found here [Redis performance report](../other/perform-redis)

If you are very performance conscious and can accept the loss of data for a short period of time (1s or so) in the event of a power failure, then you might consider this storage solution

## boltdb
boltdb is an embedded kv store that is used as a storage engine by etcd and supports ACID.

dtm also supports boltdb, which is suitable if you want to have a quick experience with dtm and save the hassle of installing mysql/redis.

See Store.Driver: "boltdb" in [conf.sample.yml](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml) for detailed configuration

When you do not configure anything, by default, dtm will use boltdb when it starts

Because boltdb is an embedded store and does not support multi-machine deployment, it is not suitable for online applications, only for a quick dtm experience.
