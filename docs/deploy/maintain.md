# Operation and Maintenance

## Alarm

Under normal circumstances, the global transaction ends quickly and the result will be recorded as succeed/failed in the status of dtm.trans_global. 
Even if there are temporary network problems, etc., the global transaction usually ends after one or two retries.
If the number of retries exceeds 3, it usually means an abnormal situation and it is better to monitor it. 
The suggested query conditions are

``` SQL
select * from dtm.trans_global where status not in ('succeed', 'failed') and
  create_time between date_add(now(), interval -3600 second) and date_add(now(), interval -120 second)
```

The Project supports monitoring and alerting by Prometheus after v1.1.0.
The exporting port for Prometheus is `8889`, which can be found in `dtmsvr/dtmsvr.go`.
This monitoring interface provides the availability and response times of the network interface (HTTP/gRPC) 
and the status of executing transactions and branches.

Specifically, the metrics include follow:

- `dtm_server_process_total`
- `dtm_server_response_duration`
- `dtm_transaction_process_total`
- `dtm_branch_process_total`

For example, a possible alert for monitoring the failures of the `confirm/cancel` type branch: 

```
sum(dtm_branch_process_total{branchtype=~"confirm|cancel",status="fail"}) by (gid, branchid) > 3
```

## Trigger global transaction to retry immediately

dtm polls the database for outstanding global transactions which timed out within the last hour. 
dtm does not check for those that are not in this range. 
If you want to trigger immediate retries manually, you can manually change the next_cron_time of the corresponding transaction to the current time to trigger retries.

The retry interval of dtm for each transaction is doubled for each failure, to avoid too many retries, which will cause the system load to rise abnormally.

There are the following scenarios where immediate retry can be used.

- A business has a bug, which causes the transaction to retry several times without completing, and the retry interval value is already large. 
  After fixing the bug, dtm needs to retry the incomplete transaction immediately
  
- If dtm is down, or the database that dtm depends on is down, and the downtime is more than 1 hour, the uncompleted global transactions are no longer within the scope of dtm auto-polling.

If you manually change the next_cron_time of the corresponding transaction to the current time, it will be polled within a few seconds.
