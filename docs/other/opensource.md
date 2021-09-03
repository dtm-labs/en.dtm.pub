# Other frameworks

There is no mature open-source distributed transaction framework for non-Java languages.
Mature open-source distributed transaction frameworks for Java language include Ali's SEATA, Huawei's ServiceComb-Pack, Jingdong's shardingsphere, himly, tcc-transaction, ByteTCC and so on, of which seata is most widely used.

The following is a comparison of the main features of dtm and seata.


| Features                | DTM                                                                                           | SEATA                                                                                            | Remarks                                                             |
| :-----:                 | :----:                                                                                        | :----:                                                                                           | :----:                                                              |
| Supported languages     | <span style="color:green">Golang, python, php and others</span>                               | <span style="color:orange">Java</span>                                                           | dtm allows easy access from a new language                            |
| Exception handling      | [Subtransaction barrier](https://zhuanlan.zhihu.com/p/388444465)                              | <span style="color:orange">manual</span>                                                         | dtm solves idempotency, hanging, null compensation                   |
| TCC                     | <span style="color:green">✓</span>                                                            | <span style="color:green">✓</span>                                                               |                                                                     |
| XA                      | <span style="color:green">✓</span>                                                            | <span style="color:green">✓</span>                                                               |                                                                     |
| AT                      | <span style="color:red">✗</span>                                                              | <span style="color:green">✓</span>                                                               | AT is similar to XA with better performance but with dirty rollback |
| SAGA                    | <span style="color:orange">Simple mode</span>                                                 | <span style="color:green">complicated state-machine mode</span>                                   | dtm's state-machine mode is being planned                         |
| Transactional Messaging | <span style="color:green">✓</span>                                                            | <span style="color:red">✗</span>                                                                 | dtm provides Transactional Messaging similar to rocketmq               |
| Communication protocols | <span style="color:green">HTTP, GRPC</span>                                                   | <span style="color:green">dubbo, no HTTP</span>                                             |                                                                     |
| star count              | <img src="https://img.shields.io/github/stars/yedf/dtm.svg?style=social" alt="github stars"/> | <img src="https://img.shields.io/github/stars/seata/seata.svg?style=social" alt="github stars"/> | dtm 0.1 is released from 20210604 and under fast development                    |
|                         |                                                                                               |                                                                                                  |                                                                     |

From the features comparison above, if your language stack includes languages other than Java, then dtm is the one for you. 
If your language stack is Java, you can also choose to access dtm and use subtransaction barrier technology to simplify your business development.
