import config from './bigchaindb.config';
import * as driver from 'bigchaindb-driver';
import * as bip39 from 'bip39';

const contract = require('truffle-contract');
const Web3 = require('web3');

let assetid = '';
let asset= 'BDBT Token';
const nTokens = 1000;
let tokensLeft = 0;
const decimals = 2;
let conn = new driver.Connection(config.url,{ 
    app_id: config.app_id,
    app_key: config.app_key
});

const bdbtokenArtifact = require('./build/contracts/BDBToken.json');
const BDBToken = contract(bdbtokenArtifact);
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
BDBToken.setProvider(web3.currentProvider);
BDBToken.defaults({from: web3.eth.coinbase});

const tokenCreator = new driver.Ed25519Keypair(bip39.mnemonicToSeed('this is token creator').slice(0,32));
const tokenReceiverKey = new driver.Ed25519Keypair(bip39.mnemonicToSeed('this is token receiver').slice(0, 32));

function publishToken() {
    const tx = driver.Transaction.makeCreateTransaction({
            token: asset,
            number_tokens: nTokens
        },
        {
            datetime: new Date().toString()
        },
        [driver.Transaction.makeOutput(driver.Transaction
          .makeEd25519Condition(tokenCreator.publicKey), nTokens.toString())],
        tokenCreator.publicKey
    );
    const txSigned = driver.Transaction.signTransaction(tx, tokenCreator.privateKey);

    conn.postTransactionCommit(txSigned).then(
        res => {
            tokensLeft = nTokens
            assetid = res.id;
        });
}

function transferTokens(tokenReceiver, amountToSend, message){
    conn.listOutputs(tokenCreator.publicKey, 'false')
        .then((txs) => {
            return findTx(txs).then(tx => {return tx; });
        })
        .then((txOutputs) => {
            const createTranfer = driver.Transaction
                .makeTransferTransaction(
                    [{
                        tx: txOutputs,
                        output_index: 0
                    }],
                    [driver.Transaction.makeOutput(
                            driver.Transaction
                            .makeEd25519Condition(tokenCreator.publicKey),
                            (tokensLeft - amountToSend).toString()),
                        driver.Transaction.makeOutput(
                            driver.Transaction
                            .makeEd25519Condition(tokenReceiver.publicKey),
                            amountToSend.toString())
                    ],
                    {
                        transfer_to: message,
                        tokens_left: (tokensLeft - amountToSend)
                    }
                );
            const signedTransfer = driver.Transaction.signTransaction(createTranfer, tokenCreator.privateKey);
            return conn.postTransactionCommit(signedTransfer);
        }).then(res => {
            tokensLeft -= amountToSend;
            console.log("Result: ",res);
        }).catch(err => {
            console.log("Error: ",err);
        })

}

//Find the correct output transaction. Note: Can be further optimised.
async function findTx(txs){
    let result = null;
    for(var i=0; i<txs.length; i++){
        result = await conn.getTransaction(txs[i].transaction_id).then(((value) => { 
            if(value.operation == "CREATE"){
                if(value.asset.data.token == asset){
                    return value;
                }
            }else if(value.operation == "TRANSFER"){
                if(value.asset.id == assetid){
                    return value;
                 }
            }else{
                return Promise.reject("No Transaction Found");
            }
        }));
        if(result != null){
            break;
        } 
    }
    return Promise.resolve(result);
}

//Publish the Token on the Network
publishToken();

//Watch for events on Ethereum Network and replicate them on BigchainDB
BDBToken.deployed().then(
    instance => {
        instance.Transfer().watch( (err, data) => {
            transferTokens(tokenReceiverKey, parseInt(data.args.value.toString())/Math.pow(10, decimals), "First Token Receiver");
        });
    }
).catch( err => {
    console.log("error:", err);
});