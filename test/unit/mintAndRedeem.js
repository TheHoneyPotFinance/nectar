const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller,
    supportMarket, pauseMint, batchMintXinv, batchMintInv,
    balanceOf, redeem, evmMine, evmSetNextBlockTimestamp } = require('../util/xinv');
const toMint1 = hre.ethers.utils.parseEther("1");
const toMint2 = hre.ethers.utils.parseEther("2");
const toRedeem1 = hre.ethers.utils.parseEther("1");

let inv;
let xHONEY;
let comptroller;
let unitroller;
let timelockEscrow;

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
    
        await hre.deployments.save('xHONEY', xHONEY);
        const escrowAddress = await xHONEY.escrow();
        timelockEscrow = await hre.ethers.getContractAt("contracts/XHONEY.sol:TimelockEscrow", escrowAddress);
    
        // Ensure HONEY is transferable in test cases.
        await inv.connect(wallets.deployer).openTheGates();
    });
    
    describe('minting and redeeming', () => {

        it('should only be minted if allowed by comptroller', async () => {
            await supportMarket(xHONEY.address, unitroller.address);
            // pause mint
            await pauseMint(unitroller.address, xHONEY.address);       

            // now attempt mint, should revert
            await batchMintInv([ wallets.admin ], toMint1);
            
            await inv.connect(wallets.admin).approve(xHONEY.address, toMint1);
            await expect(xHONEY.connect(wallets.admin).mint(toMint1)).to.be.revertedWith("revert mint is paused");
        });

        it('should only be minted if user has equal or more amount of HONEY', async () => {
            await supportMarket(xHONEY.address, unitroller.address);

            // Approve the transfer of collateral and then transfer to mint xHONEY.
            await expect(inv.connect(wallets.deployer).approve(xHONEY.address, toMint1))
                .to.emit(inv, "Approval").withArgs(wallets.deployer.address, xHONEY.address, toMint1);
            await expect(xHONEY.connect(wallets.deployer).mint(toMint1)).to.emit(xHONEY, "Mint");

            expect(await balanceOf(xHONEY, wallets.deployer.address)).to.equal(toMint1);

            // minting without enough HONEY
            await expect(xHONEY.connect(wallets.deployer).mint(toMint1)).to.be.reverted;
        });

        it('should have an underlying balance', async () => {
            await supportMarket(xHONEY.address, unitroller.address);

            // Approve the transfer of collateral and then transfer to mint xHONEY.
            await expect(inv.connect(wallets.deployer).approve(xHONEY.address, toMint1))
                .to.emit(inv, "Approval").withArgs(wallets.deployer.address, xHONEY.address, toMint1);
            await expect(xHONEY.connect(wallets.deployer).mint(toMint1)).to.emit(xHONEY, "Mint");

            // set initially to 1e18
            const exchangeRate = await xHONEY.exchangeRateStored();
            expect(exchangeRate).to.be.equal(hre.ethers.utils.parseEther("1"));
        
            const underlyingBalance  = await xHONEY.callStatic.balanceOfUnderlying(wallets.deployer.address);
            const ownerBalance = await balanceOf(xHONEY, wallets.deployer.address);
            expect(underlyingBalance).to.be.equal(ownerBalance);
        });

        it('should be able to redeem xHONEY for underlying HONEY', async() => {
            await supportMarket(xHONEY.address, unitroller.address);

            // expect failure due to insufficient approval
            await expect(xHONEY.connect(wallets.deployer).mint(toMint2)).to.be.reverted;

            // approve to spend some more
            await inv.connect(wallets.deployer).approve(xHONEY.address, hre.ethers.utils.parseEther("5"));
            await expect(xHONEY.connect(wallets.deployer).mint(toMint2)).to.emit(xHONEY, "Mint");

            // redeem cToken aka xHONEY for underlying and check balances of both xHONEY and HONEY
            await expect(redeem(xHONEY, wallets.deployer, toRedeem1)).to.emit(xHONEY, "Redeem");

            // escrow is used, so should be able to withdraw explicitly after duration
            // escrow is explicitly set to true for redeeming, so fastforward to duration and withdraw
            const timestamp = (await timelockEscrow.pendingWithdrawals(wallets.deployer.address))["withdrawalTimestamp"];
            // increase evm block time just above duration
            await evmSetNextBlockTimestamp(timestamp.toNumber());
            await evmMine();

            // withdraw funds from escrow
            const oldBalance = await balanceOf(inv, wallets.deployer.address);
            await expect(timelockEscrow.connect(wallets.deployer).withdraw())
                .to.emit(timelockEscrow, "Withdraw").withArgs(wallets.deployer.address, toRedeem1);
            
            expect(await balanceOf(inv, wallets.deployer.address)).to.be.equal(oldBalance.add(toRedeem1));
        });

        it('should be able to redeem xHONEY for specified amount of HONEY', async () => {
            await supportMarket(xHONEY.address, unitroller.address);

            await batchMintXinv([ wallets.deployer ], hre.ethers.utils.parseEther("5"));

            // instant transfer after redeem
            await timelockEscrow.connect(wallets.deployer)._setEscrowDuration(0);

            const balanceBefore = await balanceOf(inv, wallets.deployer.address);
            await expect(xHONEY.connect(wallets.deployer).redeemUnderlying(toRedeem1))
                .to.emit(xHONEY, "Transfer").withArgs(wallets.deployer.address, xHONEY.address, toRedeem1);
            expect(await balanceOf(inv, wallets.deployer.address)).to.equal(balanceBefore.add(toRedeem1));
        });
    });
});

