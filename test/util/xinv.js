const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");

let wallets = {};

let HONEYArtifact;
let XHONEYArtifact;
let ComptrollerArtifact;
let UnitrollerArtifact;
let CERC20ImmutableArtifact;
let OracleArtifact;
let OracleFeedArtifact;
let JumpRateModelV2Artifact;
let ERC20Artifact;

let inv;
let xHONEY;
let comptroller;
let unitroller;
let dola;
let nDEW;
let oracle;
let oracleFeed;
let jumpRateModelV2;
let signers;

const init = async () => {
    HONEYArtifact = await hre.artifacts.readArtifact('HONEY');
    XHONEYArtifact = await hre.artifacts.readArtifact('XHONEY');
    ComptrollerArtifact = await hre.artifacts.readArtifact('Comptroller');
    UnitrollerArtifact = await hre.artifacts.readArtifact('Unitroller');
    TokenErrorReporterArtifact = await hre.artifacts.readArtifact('TokenErrorReporter');
    CERC20ImmutableArtifact = await hre.artifacts.readArtifact('CErc20Immutable');
    OracleArtifact = await hre.artifacts.readArtifact('Oracle');
    OracleFeedArtifact = await hre.artifacts.readArtifact('OracleFeed');
    JumpRateModelV2Artifact = await hre.artifacts.readArtifact('JumpRateModelV2');
    ERC20Artifact = await hre.artifacts.readArtifact('ERC20');

    signers = await hre.ethers.getSigners();

    wallets.admin = signers[0];
    wallets.deployer = signers[1];
    wallets.delegate = signers[2];
    wallets.treasury = signers[3];
}

const deployInv = async () => {
    inv = await hre.waffle.deployContract(wallets.deployer, HONEYArtifact, [wallets.deployer.address]);
    return inv;
}

const deployComptroller = async () => {
    comptroller = await hre.waffle.deployContract(wallets.deployer, ComptrollerArtifact, []);
    return comptroller;
}

const deployUnitroller = async () => {
    unitroller = await hre.waffle.deployContract(wallets.deployer, UnitrollerArtifact, []);
    return unitroller;
}

const deployXinv = async () => {
    xHONEY =  await hre.waffle.deployContract(
        wallets.deployer,
        XHONEYArtifact,
        [
            inv.address,
            unitroller.address,
            "200000000000000000",
            wallets.treasury.address,
            "xTheHoneyPot Finance",
            "xHONEY",
            "18",
            wallets.deployer.address,
        ],
    );
    await hre.deployments.save('xHONEY', xHONEY);
    return xHONEY;
}

const deployJumpRateModelV2 = async () => {
    jumpRateModelV2 = await hre.waffle.deployContract(
        wallets.deployer,
        JumpRateModelV2Artifact,
        // Some random numbers taken from one of the deployment scenarios.
        [
            "199999999999999999",
            "190000000000000000",
            "199900000000000000",
            "15000000",
            wallets.deployer.address //inv.address,
        ],
    );
    return jumpRateModelV2;
}

const deployDew = async () => {
    dola =  await hre.waffle.deployContract(
        wallets.deployer,
        ERC20Artifact,
        [
            "Dew USD Stablecoin",
            "DEW",
            18
        ]
    );
    return dola;
}

const deployAndola = async () => {
    nDEW = await hre.waffle.deployContract(
        wallets.deployer,
        CERC20ImmutableArtifact,
        [
            dola.address,
            unitroller.address,
            jumpRateModelV2.address,
            "200000000000000000000000000",
            "Nectar Dew",
            "nDew",
            "8",
            wallets.deployer.address
        ],
    );
    return nDEW;
}

const deployOracleFeed = async () => {
    oracleFeed = await hre.waffle.deployContract(
        wallets.deployer,
        OracleFeedArtifact,
        [
            "18"
        ]
    );
    return oracleFeed;
}

const deployOracle = async () => {
    oracle = await hre.waffle.deployContract(
        wallets.deployer,
        OracleArtifact
    );
    return oracle;
}

const supportMarket = async (market_, unitroller_) => {
    // Get the proxied interface by retrieving the Comptroller contract
    // at Unitroller's address.
    const unitrollerProxy = await hre.ethers.getContractAt(
        "Comptroller",
        unitroller_,
    );

    await unitrollerProxy.connect(wallets.deployer)._supportMarket(market_);

    return unitrollerProxy;
}

const pauseMint = async (unitroller_, xHONEY_) => {
    const unitrollerProxy = await hre.ethers.getContractAt(
        "Comptroller",
        unitroller_,
    );
    await unitrollerProxy.connect(wallets.deployer)._setMintPaused(xHONEY_, true);
}

const address = async (n) => {
    const address_ = `0x${n.toString(16).padStart(40, '0')}`;
    return address_.toString();
}

const batchMintXinv = async (wallets_, toMint = hre.ethers.utils.parseEther("1")) => {
    return Promise.all(wallets_.map( async wallet => {
        await inv.connect(wallet).approve(xHONEY.address, toMint);
        await xHONEY.connect(wallet).mint(toMint);
        
        return Promise.resolve(true);
    }));
}

const batchMintInv = async (wallets_, toMint) => {
    return Promise.all(wallets_.map( async wallet => {
        return Promise.resolve(await inv.connect(wallets.deployer).mint(wallet.address, toMint));
    }));
}

const balanceOf = async (token_, address_) => {
    return await token_.balanceOf(address_);
}

const redeem = async (token_, signer_, toRedeem_) => {
    return await token_.connect(signer_).redeem(toRedeem_);
}

const getBlockNumber = async () => {
    return await hre.network.provider.send("eth_blockNumber");
}

const getBlockByBlockNumber = async (blockNumber) => {
    return await hre.network.provider.send("eth_getBlockByNumber", [ blockNumber, true ]);
}

const evmSetAutomine = async (state) => {
    return await hre.network.provider.send("evm_setAutomine", [ state ]);
}

const evmMine = async () => { return await hre.network.provider.send("evm_mine"); }

const evmIncreaseTime = async (duration_) => { 
    return await hre.network.provider.send("evm_increaseTime", [ duration_ ]);
}

const evmSetNextBlockTimestamp = async (timestamp_) => {
    return await hre.network.provider.send("evm_setNextBlockTimestamp", [ timestamp_ ]);
} 

const delegate = async (token_, signer_, delegate_) => {
    return await token_.connect(signer_).delegate(delegate_);
}

module.exports = {
    init,
    signers,
    wallets,
    deployInv,
    deployComptroller,
    deployUnitroller,
    deployXinv,
    deployJumpRateModelV2,
    deployDew,
    deployAndola,
    deployOracleFeed,
    deployOracle,
    supportMarket,
    pauseMint,
    address,
    batchMintXinv,
    batchMintInv,
    balanceOf,
    redeem,
    getBlockNumber,
    getBlockByBlockNumber,
    evmSetAutomine,
    evmMine,
    evmIncreaseTime,
    evmSetNextBlockTimestamp,
    delegate
};