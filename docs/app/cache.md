# Cache Consistency

## Overview
In real-world projects, when application QPS gets high, it is common to introduce Redis caching to ease the pressure on database queries. But once the cache is introduced, then a data is stored in both Redis and database, there will be a data consistency problem. DTM is committed to solving the data consistency problem, and after analyzing the existing practices in the industry, we propose a new architecture solution, which will be described in detail in this article

## Strong Consistency Solution
When the business load is not high, we can directly access the database, such a solution is simple and direct, no problem.

When the business volume increases, the database can easily become a bottleneck, the most convenient solution is to upgrade the underlying hardware, so that the database directly provides higher qps to cope with business growth. The advantage of this solution is that it does not require any development work, but has the following disadvantages.
- There are upper limits to upgrade the underlying hardware, the IOPS of the disk, the memory of the standalone machine, and the CPU of the standalone machine, and at a certain point, it is impossible to upgrade upwards
- Hardware upgrade is very expensive, the performance of these Hardware doubled, the cost may be 4 times, or even 10 times, this solution hardware costs rise too quickly, it is difficult to cope with the large number of users of the application

**Development impact:** This solution, the application does not require any modification at all.

## Eventually Consistent Database Solution
The above hardware upgrade is very developer friendly, but the cost is too expensive and the drawbacks are very obvious, so is there a way to do horizontal scaling so that the cost just rises linearly?

The vast majority of Internet applications are read and write applications, the use of master-slave replication of the database, read and write separation, can better cope with the problems caused by the rise in the number of users, compared with the above hardware upgrade solution. Master-slave separation has the following characteristics
- With the growth of users, you can lighten the pressure of database by adding more slave databases, the cost is linear, not exponential increase, better than the previous vertical upgrade solution
- Theoretically, a master can add a large number of slaves, and the upper limit of such expansion is much higher than the upper limit of the previous vertical upgrade scheme

But the scheme here is already eventually consistent, and it takes some time for the data to move from the master to the slave. After the application writes on the master library, it immediately goes to the slave to read, it may not read the latest data, so it is eventual consistency.

**Development Impact:** With this eventual consistency solution, development would need to make changes for the application. Development would need to distinguish between read requests with strong consistency requirements, and read requests with not-strong consistency requirements, and schedule the strong consistency to the master, and the not-strong consistency to the slave.

## Redis Caching Solution
The above database solution is very high in terms of cost per user. In today's Internet applications, where the number of users is very high, a pure database solution would result in high costs, and other technology solutions would be a better choice.

Using Redis to cache data in memory is a very common data query solution today, and compared to the database solution described above, the Redis solution has the following features.
- Data is stored in memory and access is extremely fast, with standalone Redis typically providing up to 10 to 100 times qps access than standalone databases
- Redis also supports master-slave replication, sharding, etc., making it easy to provide the qps required by the application

Redis provides perfect support for concurrent access, but it also poses a number of problems.
- Redis stores data in memory, which is not in the same format as a database, and requires manual maintenance by the developer.
- Redis does not have automatic data synchronization with the database in the same way as the previous database master-slave, so the consistency of the relevant data needs to be maintained manually by the developer.

**Development Impact:** Developers need to manually maintain cached data in a different format than the database, and they also need to solve the problem of inconsistent data between the Redis cache and the database.

## Why cache updates are inconsistent
With the introduction of the Redis cache, data is stored in both the database and Redis, and the industry generally uses a strategy of deleting/updating cached data after writing to the database. Since saving to the cache and saving to the database are not atomic operations, there must be a time difference between the two operations, so there is a window of inconsistency between the two data, which is usually not long. However, there may be downtime and various network errors in between, so it may happen that one of them is completed but not the other, resulting in a longer inconsistency in the data.

To illustrate the above inconsistency scenario, a data user modifies data A to B. After the application modifies the database, it then modifies the cache, and if no exception occurs, the data in both the database and the cache are B. However, in a distributed system, process crashes and downtimes may occur, so if a process crash occurs after updating the database and before updating the cache, then the data in the database and cache may be inconsistent for a longer period of time.

It is not an easy task to solve the above inconsistency problem, so we will introduce the solutions for various applications.

## Solution 1: Short cache time
This solution, the simplest one, is suitable for applications with little concurrency. If the qps of the application is not high, then the entire caching system, are supposed to set a short cache time, such as one minute. The load that the database needs to bear in this case is that about every minute, all the cached data that is accessed needs to be generated once, and this strategy is feasible in the case of low concurrency.

This strategy described above is very simple and easy to understand and implement. The semantics provided by the caching system is that the time window for inconsistency between the cache and the database is short in most cases, and in the case of process crashes, the inconsistency window can be as long as one minute.

While reads with strong consistency requirements do not go to the cache and are queried directly from the database.

## Solution 2: Message queue to ensure consistency
If the application has high concurrency, the cache expiration time needs to be longer than one minute, and the large number of requests in the application cannot tolerate inconsistency for a longer period of time, then this time, the cache can be deleted/updated by using a message queue. This is done as follows.
- When updating the database, simultaneously write the message to update the cache to the local table and commit it as the database update operation is committed.
- Write a polling task that continuously polls messages in the local table, and sends messages to the message queue.
- Consume the messages in the message queue and update/delete the cache

This approach ensures that the cache will definitely be updated after the database is updated. However, this architecture is very heavy, and the development and maintenance costs of these parts are hight: maintenance of the message queue; development and maintenance of efficient polling tasks.

## Solution 3: Subscribe binlog
This scenario is very similar to Solution 2, and the principle is similar to the master-slave synchronization of database. The master-slave synchronization is applied to the slave, and this solution is applied to the cache manager, which apply the updates of database to the cache. The specific approach is.
- deploy and configure a binlog subscribing component to subscribe to the database binlog
- listen to data updates and synchronizely update/delete cache

This solution also ensures that the cache will be updated after the database is updated, but this architectural solution is very heavy, just like the previous one. On the one hand, binlog subscribing component is expensive to learn and maintain, on the other hand, developers may only need a small amount of data to update the cache, and it is wasteful to do this by subscribing to all binlogs.

## Solution 4: 2-phase messaging Solution
The 2-phase message solution in dtm is perfect for updating/deleting the cache after modifying the database here, with the following main code.

``` Go
msg := dtmcli.NewMsg(DtmServer, gid).
	Add(busi.Busi+"/UpdateRedis", &Req{Key: key1})
err := msg.DoAndSubmitDB(busi.Busi+"/QueryPrepared", db, func(tx *sql.Tx) error {
  // update db data with key1
})
```

In this code, DoAndSubmitDB will perform a local database operation to modify the database data, and when the modification is complete, it will submit a 2-phase message transaction, which will call UpdateRedis asynchronously. 2-phase messaging ensures that UpdateRedis will be executed at least once if the local transaction is committed successfully.

If there is a crash just after commit and before submit message, dtm will call `QueryPrepared` to check. The checkback logic is very simple, just copy code like the following.
``` Go
	app.GET(BusiAPI+"/QueryPreparedB", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
		return MustBarrierFromGin(c).QueryPrepared(dbGet())
	}))
```

Advantages of this solution:
- The solution is simple and easy to use, the code is short and easy to read
- dtm itself is a stateless common application, relying on the storage engine redis/mysql which is a common infrastructure, without maintaining additional message queues or canal
- The related operations are modular and easy to maintain, no need to write consumer logic elsewhere like message queues or canal

