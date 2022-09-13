const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket, balanceOf, getBlockNumber,
    evmSetAutomine, evmMine } = require('../util/xinv');

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
    
    describe('accrue interest', () => {

        beforeEach( async () => {
            await supportMarket(xHONEY.address, unitroller.address);
        });

        it('should set the right rewards per block and treasury on init', async () => {
            const setRewardPerBlock = "200000000000000000";
            const setTreasury = wallets.treasury.address;

            expect(await xHONEY.rewardPerBlock()).to.equal(setRewardPerBlock);
            expect(await xHONEY.rewardTreasury()).to.equal(setTreasury);
        });

        it('should only allow admin to set treasury reward', async () => {
            const nonAdmin = wallets.delegate;
            const admin = wallets.deployer;
            const newTreasury = wallets.treasury;
            
            const treasuryBefore = await xHONEY.rewardTreasury();
            // expect no change in reward treasury
            await xHONEY.connect(nonAdmin)._setRewardTreasury(newTreasury.address);
            expect(await xHONEY.rewardTreasury()).to.equal(treasuryBefore);

            await expect(xHONEY.connect(admin)._setRewardTreasury(newTreasury.address))
                .to.emit(xHONEY, "NewRewardTreasury").withArgs(treasuryBefore, newTreasury.address);
            expect(await xHONEY.rewardTreasury()).to.equal(newTreasury.address);
        });

        it('should only allow admin to set reward per block', async () => {
            const nonAdmin = wallets.delegate;
            const admin = wallets.deployer;
            const newReward = "300000000000000000";
            
            const rewardBefore = await xHONEY.rewardPerBlock();
            // expect no change in reward per block with non-admin
            await xHONEY.connect(nonAdmin)._setRewardPerBlock(newReward);
            expect(await xHONEY.rewardPerBlock()).to.equal(rewardBefore);

            await expect(xHONEY.connect(admin)._setRewardPerBlock(newReward))
                .to.emit(xHONEY, "NewRewardPerBlock").withArgs(rewardBefore, newReward);
            expect(await xHONEY.rewardPerBlock()).to.equal(newReward);
    
        });

        it('should fail accruing twice on a given block and update accrual blocknumber after interest accrual', async () => {
            // simulate 2 calls in one block
            await evmSetAutomine(false);

            let accrualBlockNumberBefore = await getBlockNumber();
            await xHONEY.accrueInterest();
            await xHONEY.accrueInterest();
            let accrualBlockNumberAfter = await getBlockNumber();
            await evmMine();
            expect(accrualBlockNumberAfter).to.equal(accrualBlockNumberBefore);

            await evmSetAutomine(true);
            accrualBlockNumberBefore = await getBlockNumber();
            await xHONEY.accrueInterest();
            await xHONEY.accrueInterest();
            accrualBlockNumberAfter = await getBlockNumber();
            expect(BigNumber.from(accrualBlockNumberAfter)).to.equal(BigNumber.from(accrualBlockNumberBefore).add(2));
        });

        it('ensures right amount of interest is accrued for a given delta', async () => {
            await evmSetAutomine(false);
            const toMint = "10000000000000000000";
            await inv.connect(wallets.deployer).mint(wallets.treasury.address, toMint);
            await inv.connect(wallets.deployer).mint(wallets.deployer.address, toMint);
            await inv.connect(wallets.deployer).approve(xHONEY.address, toMint);
            await xHONEY.mint(toMint);
            await xHONEY.accrueInterest();
            await evmMine();
            // cannot transfer in after accrueInterest due to not enough allowance
            expect(await balanceOf(inv, xHONEY.address)).to.equal(toMint);

            await inv.connect(wallets.treasury).approve(xHONEY.address, toMint);

            const delta = 3;
            const expectedReward = String((await xHONEY.rewardPerBlock()) * delta);

            // xHONEY contract balance of underlying
            const contractBalanceBefore = await balanceOf(inv, xHONEY.address);
            // create delta of 3
            await xHONEY.accrueInterest();
            await evmMine();
            await xHONEY.accrueInterest();
            await evmMine();
            await xHONEY.accrueInterest();
            await evmMine();

            await evmSetAutomine(true);

            const contractBalanceAfter = await balanceOf(inv, xHONEY.address);
            expect(contractBalanceAfter).to.equal(contractBalanceBefore.add(expectedReward));  
        });

        it('should accrue interest from treasury', async () => {
            const toMint = "10000000000000000000";
            await inv.connect(wallets.deployer).mint(wallets.treasury.address, toMint);
            await inv.connect(wallets.treasury).approve(xHONEY.address, toMint);
            await inv.connect(wallets.deployer).mint(wallets.deployer.address, toMint);
            await inv.connect(wallets.deployer).approve(xHONEY.address, toMint);
            await xHONEY.mint(toMint);

            const contractBalanceBefore = await balanceOf(inv, xHONEY.address);
            const treasuryBalanceBefore = await balanceOf(inv, wallets.treasury.address);
            const blockNumberPrior = await xHONEY.accrualBlockNumber();
            await xHONEY.accrueInterest();
            const blockNumberCurrent = await xHONEY.accrualBlockNumber();
            const expectedReward = (await xHONEY.rewardPerBlock()).mul(blockNumberCurrent.sub(blockNumberPrior));
            const treasuryBalanceAfter = await balanceOf(inv, wallets.treasury.address);
            const contractBalanceAfter = await balanceOf(inv, xHONEY.address);

            expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore.sub(expectedReward));
            expect(contractBalanceAfter).to.equal(contractBalanceBefore.add(expectedReward));
        });
    });
});