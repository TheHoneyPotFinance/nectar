const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, 
    supportMarket, batchMintXinv, batchMintInv,
    balanceOf, getBlockNumber,
    evmSetAutomine, evmMine,
    delegate } = require('../util/xinv');
const toMint3 = hre.ethers.utils.parseEther("3");

let inv;
let xHONEY;
let comptroller;
let unitroller;

describe("xHONEY Test", () => {

    before( async () => {
        await init();
    });
    
    beforeEach( async () => {
        inv = await deployInv();
        comptroller = await deployComptroller();
        unitroller = await deployUnitroller();
    
        await unitroller.connect(wallets.deployer)._setPendingImplementation(comptroller.address);
        await comptroller.connect(wallets.deployer)._become(unitroller.address);
    
        xHONEY = await deployXinv();
    
        // Ensure HONEY is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    describe('checkpoints', () => {
        beforeEach( async () => {
            await supportMarket(xHONEY.address, unitroller.address);

            await batchMintInv([wallets.admin, wallets.delegate], toMint3);
            await batchMintXinv([wallets.admin, wallets.deployer], toMint3);

            expect(await balanceOf(xHONEY, wallets.deployer.address)).to.be.equal(toMint3);
            expect(await balanceOf(xHONEY, wallets.admin.address)).to.be.equal(toMint3);
        });

        it('returns the number of checkpoints for a delegate', async () => {
            const txn1 = await delegate(xHONEY, wallets.deployer, wallets.delegate.address);
            expect(await xHONEY.numCheckpoints(wallets.delegate.address)).to.be.equal(1);

            // 2 different delegations to delegate
            const txn2 = await delegate(xHONEY, wallets.admin, wallets.delegate.address);
            expect(await xHONEY.numCheckpoints(wallets.delegate.address)).to.be.equal(2);

            const checkPoint1 = await xHONEY.checkpoints(wallets.delegate.address, 0);
            const checkPoint2 = await xHONEY.checkpoints(wallets.delegate.address, 1);

            expect(checkPoint1).to.have.property('fromBlock').to.equal(txn1.blockNumber);
            expect(checkPoint1).to.have.property('votes').to.equal(hre.ethers.utils.parseEther('3'));

            expect(checkPoint2).to.have.property('fromBlock').to.equal(txn2.blockNumber);
            expect(checkPoint2).to.have.property('votes').to.equal(hre.ethers.utils.parseEther('6'));

        });
        // this test only works with hardhat 2.2.0 due to "evm_setAutomine" for runtime mining manipulation
        it('does not include more than one checkpoint in a block', async () => {
            // trigger to not mine new block automatically, unless explicit mining
            await evmSetAutomine(false);

            const stopMiningBlockNumber = await getBlockNumber();

            // # of checkpoints for delegate at this stage should be 0
            expect(await xHONEY.numCheckpoints(wallets.delegate.address)).to.equal(0);

            // only one of these should be mined in the next block after mining resumed
            await delegate(xHONEY, wallets.admin, wallets.delegate.address);
            await delegate(xHONEY, wallets.deployer, wallets.delegate.address);
         
            await evmMine();

            const afterStartMiningBlockNumber = await getBlockNumber();

            // only 1 block mined, which we explicitly did above
            expect(afterStartMiningBlockNumber - stopMiningBlockNumber).to.be.equal(1);

            // delegated twice but only 1 mined
            expect(await xHONEY.numCheckpoints(wallets.delegate.address)).to.equal(1);

            // only one of two txns successfully mined
            expect(await xHONEY.checkpoints(wallets.delegate.address, 0))
                .to.have.property('fromBlock').to.equal(BigNumber.from(afterStartMiningBlockNumber));
            
            // didn't make it to block after mining resumed
            expect(await xHONEY.checkpoints(wallets.delegate.address, 1))
                .to.have.property('fromBlock').to.equal(0); 

            await evmSetAutomine(true);
        });
    });
});