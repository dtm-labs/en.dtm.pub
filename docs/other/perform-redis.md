## Redis Storage Engine Performance Test Report

## Overview
Previously dtm gave a performance test report of Mysql as a storage engine, which was able to support about 900+ distributed transactions per second on an average configured machine with 2.68w IOPS and 4 cores and 8G machines, which can meet the business needs of most companies.

This time, we bring you a test report on the Redis storage engine, which is capable of reaching about 10,800 distributed transactions per second on a commonly configured machine, which is about a 10x performance improvement over Mysql storage, meeting the business needs of most companies.

Let's detail the steps of the test and analyze the various factors that affect the performance.

## Testing Environment
The following servers are from AliCloud, and the region is Tokyo (external network access is more convenient)

Redis server: ecs.hfc6 4 cores 8G CPU main frequency 3.1 GHz/3.5 GHz intranet send/receive packets 500,000 PPS ubuntu 20.04

Two application servers: ecs.hfc6 8 core 16G CPU main frequency 3.1 GHz/3.5 GHz intranet send/receive packets 800,000 PPS ubuntu 20.04

## Testing steps.

### Prepare Redis
Prepare Redis on top of the above Redis server. This time, because of the extreme performance, instead of using docker installation, use apt install to install it, and run the following command
``` bash
apt update
apt install -y redis
# Modify /etc/redis/redis.conf to bind 0.0.0.0
systemctl restart redis-server
```

### Configure the application server
``` bash
apt update
apt install -y git
git clone https://github.com/dtm-labs/dtm.git && cd dtm && git checkout 5907f99 && cd bench && make
```

Note that the following steps are required for both application servers

### Configure dtm
Modify the conf.sample.yml in the dtm directory to configure the use of Redis, e.g.
```
Store:
  Driver: 'redis'
	Host: 'redis ip'
	Port: 6379

# Also remove the configuration inside ExamplesDB, because we don't have mysql installed
````

### Start the bench server
`
LOG_LEVEL=warn go run bench/main.go redis
`

### Start the tests
`
ab -n 1000000 -c 10 "http://127.0.0.1:8083/api/busi_bench/benchEmptyUrl"
`

### Get the results

I see here that ab's results show that the number of operations completed per second for both application servers adds up to 10875

## Redis Performance Analysis
Let's first look at the performance of Redis itself and what factors affect it, starting with these test data below.

`
redis-benchmark -n 300000 SET 'abcdefg' 'dddddd'
`

Number of requests completed per second 100K

`
redis-benchmark -h intranet other host IP -p 6379 -n 300000 SET 'abcdefg' 'dddddddd'
`

Number of requests completed per second 100K

From these two results above, the performance difference between the local Redis test and the remote Redis test is not significant. I have also tested more commands and found no significant differences, so I will focus on testing local Redis performance and not compare the differences between local and remote.

`
redis-benchmark -n 300000 EVAL "redis.call('SET', 'abcdedf', 'dddddd')" 0
`

Lua script completes 100K requests per second

`
redis-benchmark -n 300000 EVAL "redis.call('SET', KEYS[1], ARGS[1])" 1 'aaaaaaaaaa' 'bbbbbbbbbbbbb'
`

Lua script completes 100K requests per second

`
redis-benchmark -n 3000000 -P 50 SET 'abcdefg' 'dddddd'
`

With Pipeline, the requests complete at 1.50M per second, which is a significant performance improvement over a single Set operation. The comparison between this data and a single operation shows that Redis itself does not have much overhead for memory operations, but spends much of its overhead on network IO, so batch tasks can significantly increase throughput

`
redis-benchmark -n 300000 EVAL "for k=1, 10 do; redis.call('SET', KEYS[1], ARGS[1]); end" 1 'aaaaaaaaaa' 'bbbbbbbbbbbbbbb'
`

Inside Lua, we execute 10 consecutive Sets, and the number of requests completed per second is 61K, which is not very different from executing only 1 Set. This result is within our expectations, as the previous Pipeline results show that Redis' memory operation overhead is substantially less than that of the network.

`
## dtm Performance Analysis
dtm needs to track the progress of globally distributed transactions, and we take the example of the Saga under test, which involves roughly the following operations.
- Saving transaction information, including global transactions, transaction branches, and indexes to find expired transactions. dtm uses a Lua script to perform these operations
- Modify the transaction branch state when each transaction branch is completed. Since it is necessary to make sure that the global transaction is in the correct state when modifying the state to avoid rolling back transactions that are still in progress, dtm also uses a Lua script to do this
- The global transaction is completed, and the global transaction is modified to be successful. At this point, it is also necessary to avoid overwriting the transaction in the rollback that has timed out, and it is also necessary to confirm the state modification, also in a Lua script

So the theoretical overhead of a transaction on Redis is about the overhead of 4 Lua scripts, so judging from the previous ability to complete about 60K simple Lua scripts per second, it is ideal to complete 15K distributed transactions per second. Since the actual Lua scripts are more complex and transfer more data than we tested, the final 10.8K transactions per second is about the performance limit.

## Outlook
10K transactions per second is already a very high performance, enough to handle most scenarios. This includes message queues, flash-sales, etc.

When Redis is able to support such a large volume of transactions, if it is such a large volume of transactions for a long time, then redis storage space will soon be insufficient, and options may be added subsequently to allow timely cleanup of completed transactions

Will the performance of dtm improve in the future? We can look at two aspects.

One is that in the current single-process case, dtm can reach 10K transactions per second. On redis 6.0, official data shows that 4CPU performance is about 150% higher, so dtm is expected to be able to support 25K transactions per second.

The other is that dtm is moving in the direction of clustering, providing clustering capabilities, allowing dynamic scaling and so on. This aspect needs to see the future use and then make related planning.

