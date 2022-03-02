# HTTP Reference

## Overview
DTM can interact via HTTP protocol. Because of the special nature of the transaction itself, it is different from ordinary api calls that only distinguish between success and failure. For details of the DTM result status, please refer to [interface protocol](../practice/arch#proto)

The interfaces are divided into three main categories: AP interface to call TM, AP interface to call RM, and TM interface to call RM. We only describe the interface provided by TM, so that developers can write a SDK quickly.

## AP interface to TM

The path to this part of the interface is prefixed with /api/dtmsvr; for example, the actual path to prepare, as described later, is /api/dtmsvr/prepare

If this part of the interface changes the state of the transaction, dtm will do the relevant check on the transaction state, which may fail and return an error. To illustrate with a practical example.

If the transaction state is already FAILED when prepare is called, then dtm will return error code 409 with the following error
``` JSON
{
    "dtm_result": "FAILURE",
    "message": "current status 'failed', cannot prepare"
}
```

The details of each interface are as follows.

## newGid

This interface is used to get the gid. dtm's gid is generated using ip+snowflake, which has a very low probability of duplicating the gid if the ip is reused in a short period of time.

Because almost every company has its own unique id generation base settings, it is recommended to use your own internal unique id generation algorithm for the gid used in dtm.

| Interface Name | Request Method | Request Format | Applicable Transactions |
|:----:|:-----:|:----:|:-----:|
| newGid | GET | - | - |

Example request
``` bash
curl 'localhost:36789/api/dtmsvr/newGid'
```

Sample response
``` JSON
{
    "dtm_result": "SUCCESS",
    "gid": "c0a8038b_4nxAcyxSX8N"
}
```

## prepare

This interface is used to prepare the transaction, which will be committed subsequently under normal circumstances.

| interface name | request method | request format | applicable transactions |
|:----:|:-----:|:----:|:-----:|
| prepare | POST | JSON | [MSG][], [TCC][], [XA][] |

Example requests
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/prepare' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "xxx",
    "trans_type": "tcc"
}'
```

Example response
``` JSON
{
    "dtm_result": "SUCCESS"
}
```

MSG's prepare request also carries branch information
## prepare example
Example request
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/prepare' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "TestMsgTimeoutSuccess",
    "trans_type": "msg",
    "steps":[
        {
            "action": "http://localhost:8081/api/busi/TransOut"
        },
        {
            "action": "http://localhost:8081/api/busi/TransIn"
        }
    ],
    "payloads":[
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}",
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}""
    ],
    "query_prepared": "http://localhost:8081/api/busi/CanSubmit"
}'
```
- steps specifies that the entire transaction will be divided into multiple steps, each with a forward action url of action
- payloads indicates the body of the http request in each step
- query_prepared specifies the url to query after the transaction message times out

## submit

This interface is used to submit global transactions

| interface name | request method | request format | applicable transactions |
|:----:|:-----:|:----:|:-----:|
| submit | POST | JSON | [MSG][], [SAGA][], [TCC][], [XA][] |

Example request
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/submit' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "xxx",
    "trans_type": "tcc"
}'
```

Example response
``` JSON
{
    "dtm_result": "SUCCESS"
}
```

Where the MSG and SAGA submits will also carry branch information

## submit example 1
Example request
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/submit' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "TestMsgNormal",
    "trans_type": "msg",
    "steps":[
        {
            "action": "http://localhost:8081/api/busi/TransOut"
        },
        {
            "action": "http://localhost:8081/api/busi/TransIn"
        }
    ],
    "payloads":[
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}",
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}"
    ]
}'
```
See MSG's prepare example above for detailed field meanings

## submit example2
Example request
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/submit' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "TestSagaNormal",
    "trans_type": "saga",
    "steps":[
        {
            "action": "http://localhost:8081/api/busi/TransOut",
            "compensate": "http://localhost:8081/api/busi/TransOutRevert"
        },
        {
            "action": "http://localhost:8081/api/busi/TransIn",
            "compensate": "http://localhost:8081/api/busi/TransInRevert"
        }
    ],
    "payloads":[
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}",
        "{\"amount\":30,\"transInResult\":\"SUCCESS\",\"transOutResult\":\"SUCCESS\"}"
    ]
}'
```

- steps specifies that the whole transaction will be divided into multiple steps, each step's forward action url is action, and the compensate action url is compensate
- payloads the body of each step http request

## abort

This interface is used to roll back the global transaction

| interface name | request method | request format | applicable transactions |
|:----:|:-----:|:----:|:-----:|
| abort | POST | JSON | [TCC][], [XA][] |

Example requests
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/abort' \
--header 'Content-Type: application/json' \
--data-raw '{
    "gid": "xxx",
    "trans_type": "tcc"
}'
```

Example response
``` JSON
{
    "dtm_result": "SUCCESS"
}
```

## registerBranch

This interface is used in TCC, XA transaction mode to register a transaction branch

| interface name | request method | request format | applicable transactions |
|:----:|:-----:|:----:|:-----:|
| registerBranch | POST | JSON | [XA][] [TCC][] |

## registerBranch Example 1
``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/registerBranch' \
--header 'Content-Type: application/json' \
--data-raw '{
    "branch_id": "0101",
    "gid": "c0a8038b_4nxEEB1M7K3",
    "trans_type": "xa",
    "url": "http://localhost:8081/api/busi/xa"
}'
```
- url: address of the service where the final commit/rollback is performed in xa transaction mode

## registerBranch Example 2

``` bash
curl --location --request POST 'localhost:36789/api/dtmsvr/registerTccBranch' \
--header 'Content-Type: application/json' \
--data-raw '{
    "branch_id": "01",
    "cancel": "http: