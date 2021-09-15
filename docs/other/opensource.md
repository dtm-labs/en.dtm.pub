# Other frameworks

There is no mature open-source distributed transaction framework for non-Java languages.
Mature open-source distributed transaction frameworks for Java language include Ali's Seata, Huawei's ServiceComb-Pack, Jingdong's shardingsphere, himly, tcc-transaction, ByteTCC and so on, of which Seata is most widely used.

The following is a comparison of the main features of dtm and Seata.


| Features                | DTM                                                                                           | Seata                                                                                            | Remarks                                                             |
| :-----:                 | :----:                                                                                        | :----:                                                                                           | :----:                                                              |
| Supported languages     | <span style="color:green">Golang, python, php and others</span>                               | <span style="color:orange">Java</span>                                                           | dtm allows easy access from a new language                            |
| Exception handling      | [Sub-transaction barrier](https://zhuanlan.zhihu.com/p/388444465)                             | <span style="color:orange">manual</span>                                                         | dtm solves idempotent transaction, hanging, null compensation                   |
| TCC                     | <span style="color:green">✓</span>                                                            | <span style="color:green">✓</span>                                                               |                                                                     |
| XA                      | <span style="color:green">✓</span>                                                            | <span style="color:green">✓</span>                                                               |                                                                     |
| AT                      | <span style="color:red">✗</span>                                                              | <span style="color:green">✓</span>                                                               | AT is similar to XA with better performance but with dirty rollback |
| SAGA                    | <span style="color:orange">Simple mode</span>                                                 | <span style="color:green">complicated state-machine mode</span>                                   | dtm's state-machine mode is being planned                         |
| Transactional Messaging | <span style="color:green">✓</span>                                                            | <span style="color:red">✗</span>                                                                 | dtm provides Transactional Messaging similar to RocketMQ               |
| Communication protocols | <span style="color:green">HTTP, gRPC</span>                                                   | <span style="color:green">Dubbo, no HTTP</span>                                             |                                                                     |
| star count              | <img src="https://img.shields.io/github/stars/yedf/dtm.svg?style=social" alt="github stars"/> | <img src="https://img.shields.io/github/stars/seata/seata.svg?style=social" alt="github stars"/> | dtm 0.1 is released from 20210604 and under fast development                    |

From the features comparison above, if your language stack includes languages other than Java, then dtm is the one for you.
If your language stack is Java, you can also choose to access dtm and use sub-transaction barrier technology to simplify your business development.
