# Transaction Options

## Overview
The following options can be set for dtm transactions:
``` Go
type TransOptions struct {
	WaitResult bool ``json: "wait_result,omitempty" gorm:"-"`
	TimeoutToFail int64 `json: "timeout_to_fail,omitempty" gorm:"-"` // for trans type: saga xa tcc
	RetryInterval int64 `json: "retry_interval,omitempty" gorm:"-"` // for trans type: msg saga xa tcc
	BranchHeaders map[string]string `json: "branch_headers,omitempty" gorm:"-"`
}
```

In Saga, Msg transaction mode, these options can be set after the transaction object is generated

XA needs to be set in the second parameter callback function of XaGlobalTransaction2

TCC is set in the third parameter callback function of TccGlobalTransaction2
## WaitResult

The above describes the various modes, each of which returns the transaction immediately after it is committed, without waiting for the transaction to finish. However, in some practical application scenarios, many times it is desired to return the final result to the user after the entire global transaction has completed, and dtm supports this.

This is supported by dtm through the WaitResult option in the transaction. If all is well, all branch operations are successfully completed and the global transaction is successful, then SUCCESS is returned. if a branch operation of the global transaction is abnormal, then an error is returned and the relevant branch operation will be retried after a timeout.

The client checks the error returned by Submit, and if it is nil, it means that the whole global transaction has completed properly. If it is not nil, it does not mean that the global transaction has been rolled back. There are many possible cases, and it is better for the client to query the status of the global transaction through the query interface of dtm.

The WaitResult option is available for: Saga/Xa/Tcc/Msg.

You can search for WaitResult in the sample project [dtm-examples](https://github.com/dtm-labs/dtm-examples) to see an example of this

## TimeoutToFail
The dtm server has a configuration item TimeoutToFail: he specifies the default timeout failure duration for global transactions (the system default is 33 seconds).

After a TCC, XA transaction exceeds TimeoutToFail, it will timeout and try to rollback. You can modify the system default or specify the TimeoutToFail for the transaction individually

The MSG transaction mode interprets TimeoutToFail differently from other transaction modes in that it means that after this time, global transactions that only called Prepare, but not Submit, are backchecked. MSG transaction mode does not roll back after Submit.

SAGA transactions may be short or long transactions, and the timeout spans a very wide range, so the value set by the system is not used, but the TimeoutToFail of the transaction can be specified separately.

You can search for TimeoutToFail in the sample project [dtm-examples](https://github.com/dtm-labs/dtm-examples) to see an example of this

## RetryInterval

DTM will retry many transaction branch operations, the retry interval is RetryInterval (the system default is 10 seconds), you can modify the system's default value, you can also specify the transaction's RetryInterval separately

DTM retry using the exponential retreat algorithm, if the retry fails, it will double the retry interval and then retry; if a retry succeeds, then the interval will be reset to avoid the subsequent normal operation using a too large interval

If you do not want the exponential retreat algorithm, but want a fixed interval, for example, you have booked a ticket and need to check the result regularly, then you can return ONGOING in your service, when DTM receives this return value, it will not take the exponential retreat algorithm, but retry according to the set interval

You can search for RetryInterval in the sample project [dtm-examples](https://github.com/dtm-labs/dtm-examples) to see an example of this
## BranchHeaders

Some of the subtransactions in your business require custom header. dtm supports global transaction granularity header customization, i.e. you can specify different custom header for different global transactions, and dtm will add your specified header when it calls your subtransaction service.

You can search for BranchHeaders in the sample project [dtm-examples](https://github.com/dtm-labs/dtm-examples) to see an example of this
