# Who is using

If you are using dtm, please help us to proliferate dtm better by adding a comment at [this link](https://github.com/dtm-labs/dtm/issues/7).

## Case studies

#### Tencent {#tencent}
Tencent has several internal business units that use dtm, covering many business scenarios.

dtm merged several PRs mentioned by Tencent staff, with features such as Polaris, multiple log outputs, uber automaxprocs, MaxOpenConns, etc. Special thanks to Tencent staff!

These features of dtm are developed with priority to the needs of Tencent.
- Logs using uber zap
- Redis storage engine
- Concurrent Saga
- Header support

[company website](https://www.tencent.com)
#### Ivy Dad {#ivydad}
This is an online education company where I previously served as CTO

dtm first solved the need from Ivydad, at that time, after researching the existing solutions and doing the initial architecture design, we thought that distributed transactions in the field of go was a strong need, our architecture design, many of our innovations were very advanced in the industry, and making dtm open source would allow dtm to get a very good development

Although the concurrency could be increased by splitting microservices, the consistency was difficult to guarantee. Only Java has a mature solution in the market, represented by Seata. We had too much work to cut the server-side language into Java, so a new solution was needed, thus the birth of dtm.

[company website](https://www.ivydad.com)

## User List

The following contains only some of the users

<div style='vertical-align: middle'>
    <img alt='Tencent' height='80' src='../imgs/company/tencent.jpeg' />
    <img alt='IvyDad' height='80' src='../imgs/company/ivydad.png' />
    <img alt='Eglass' height='80' src='../imgs/company/eglass.png' />
    <img alt='jiou' height='80' src='../imgs/company/jiou.png' />
    <img alt='goldendata' height='80' src='../imgs/company/gdci.png' />
</div>
