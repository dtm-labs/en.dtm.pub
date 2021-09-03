# Waiting for transaction results

We have described the transaction models supported in DTM.
The default behavior using all transaction models is to return immediately to the caller after the transaction is committed, without waiting for the transaction to finish. 
However, in some application scenarios in practice, the user wants to know the result of the entire transaction, which is supported by DTM.

You can refer to the example [saga wait](https://github.com/yedf/dtm/blob/main/examples/http_saga_wait.go)

All global transaction model objects, Saga/Xa/Tcc/Msg, have an additional WaitResult parameter.

With WaitResult set to true, after the global transaction is committed to DTM, DTM will synchronously process the transaction for one round.
If everything is OK, DTM returns SUCCESS.
If a branch of the global transaction has a problem such as timing out, DTM returns an error, but will subsequently retry the relevant branch.

The client should check the error returned by Submit.
If it is nil, the entire global transaction has completed properly. 
If it is not nil, it does not mean that the global transaction has been rolled back. 
There are many possible cases, and the client is recommended to query the status of the global transaction through the query interface of DTM.

