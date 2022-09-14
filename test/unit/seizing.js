const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, deployJumpRateModelV2,
    deployOracleFeed, deployAndola, deployDew, deployOracle, 
    supportMarket, batchMintXinv, batchMintInv,
    evmMine } = require('../util/xinv');
const toMint3 = hre.ethers.utils.parseEther("3");

let inv;
let xHONEY;
let comptroller;
let unitroller;
let dola;
let nDEW;
let oracle;
let oracleFeed;
let jumpRateModelV2;

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
    
    describe('seizing', () => {

        let unitrollerProxy_;

        beforeEach( async () => {
            unitrollerProxy_ = await supportMarket(xHONEY.address, unitroller.address);

            await batchMintInv([ wallets.delegate, wallets.admin ], toMint3);
            await batchMintXinv([ wallets.deployer, wallets.admin ], toMint3);

            // create 2nd cToken market
            // set insanely high interest rate for testing purposes
            jumpRateModelV2 = await deployJumpRateModelV2();

            dola = await deployDew();

            nDEW = await deployAndola();
            // support nDEW market
            await expect(unitrollerProxy_.connect(wallets.deployer)._supportMarket(nDEW.address)).to.emit(unitrollerProxy_, "MarketListed");

            oracleFeed = await deployOracleFeed();

            // set comptroller price oracle
            oracle = await deployOracle();
            const collateralPrice = hre.ethers.utils.parseEther("1");
            const borrowedPrice = BigNumber.from(2e10); // nDEW
            await oracle.connect(wallets.deployer).setFeed(xHONEY.address, oracleFeed.address, 18);
            const feedData = await oracle.feeds(xHONEY.address);
            expect(feedData["addr"]).to.equal(oracleFeed.address);
            expect(feedData["tokenDecimals"]).to.equal(18);

            await oracle.connect(wallets.deployer).setFixedPrice(xHONEY.address, collateralPrice);
            expect(await oracle.fixedPrices(xHONEY.address)).to.equal(collateralPrice);

            await oracle.connect(wallets.deployer).setFixedPrice(nDEW.address, borrowedPrice);
            expect(await oracle.fixedPrices(nDEW.address)).to.equal(borrowedPrice);

            await expect(unitrollerProxy_.connect(wallets.deployer)._setPriceOracle(oracle.address)).to.emit(unitrollerProxy_, "NewPriceOracle");
        });

        it('seizes borrower collateral tokens when undercollateralized', async () => {
            const borrower = wallets.admin;
            const liquidator = wallets.deployer;
            // set params
            await supportMarket(xHONEY.address, unitroller.address);
            await supportMarket(nDEW.address, unitroller.address);
            expect((await unitrollerProxy_.markets(xHONEY.address))["isListed"]).to.equal(true);
            expect((await unitrollerProxy_.markets(nDEW.address))["isListed"]).to.equal(true);

            await expect(unitrollerProxy_.connect(wallets.deployer)._setCollateralFactor(xHONEY.address, "900000000000000000")).to.emit(unitrollerProxy_, "NewCollateralFactor");
            await expect(unitrollerProxy_.connect(wallets.deployer)._setCollateralFactor(nDEW.address, "900000000000000000")).to.emit(unitrollerProxy_, "NewCollateralFactor");
            expect((await unitrollerProxy_.markets(xHONEY.address))["collateralFactorMantissa"]).to.equal("900000000000000000");
            
            // close factor. to calculate repayment
            await unitrollerProxy_.connect(wallets.deployer)._setCloseFactor("1000000000000000000");
            // incentive for liquidators
            await expect(unitrollerProxy_.connect(wallets.deployer)._setLiquidationIncentive("1100000000000000000"))
                .to.emit(unitrollerProxy_, "NewLiquidationIncentive");
            
            // transfer almost max of inv to borrower
            await batchMintInv([ borrower ], "999000000000000000000"); // 999
            await batchMintXinv([ borrower ], "999000000000000000000"); // 999

            await unitrollerProxy_.connect(wallets.deployer).enterMarkets([ xHONEY.address, nDEW.address ]);

            // mint enough dola (nDEW underlying)
            await dola.connect(wallets.deployer).mint(wallets.deployer.address, "850000000000000000000000"); // 850,000 DEW
            await dola.connect(wallets.deployer).mint(borrower.address, "50000000000000000000000"); // 50,000 DEW

            await dola.connect(wallets.deployer).approve(nDEW.address, "850000000000000000000000");

            // mint nDEW to provide underlying dola liquidity to anchor
            await dola.connect(borrower).approve(nDEW.address, "50000000000000000000000");
            await nDEW.connect(borrower).mint("50000000000000000000000"); // 50,000

            // check deposits (collaterals) of borrower

            // borrow ~ available balance (this amount should be less than total dola + minted nDEW)
            await nDEW.connect(borrower).borrow("45000000000000000000000");
            // at this point, borrower has 50K nDEW and 45K dola
            // mine many blocks to accrue interest and make borrower undercollateralized
            // account is immediately liquidatable once shortfall > 0
            let shortfall = 0;
            while (shortfall == 0) {
                await evmMine();
                await nDEW.accrueInterest();
                const [ _err, _liquidity, shortfall_ ] = await unitrollerProxy_.getAccountLiquidity(borrower.address);
                if (shortfall_ > 0) {
                    shortfall = shortfall_;
                }
            }
            
            // calculate amount to repay
            // accrue interest and get borrow balance stored for borrower
            await nDEW.accrueInterest();
            const toRepay = await nDEW.borrowBalanceStored(borrower.address);

            // seizable collateral tokens
            // tokens are transferred to liquidator in underlying
            // amount = scaled exchange rate * seizeTokens
            const [ _err, seizableXHONEY ] = await unitrollerProxy_.liquidateCalculateSeizeTokens(nDEW.address, xHONEY.address, toRepay);

            const liquidatorSeizeTokensUnderlyingBefore = await inv.balanceOf(liquidator.address);
            const exchangeRateMantissa = await xHONEY.exchangeRateStored(); // same as current exchange rate
            const liquidatorExpectedRedeemedUnderlying = seizableXHONEY.mul(exchangeRateMantissa.div("1000000000000000000"));
            const borrowerXHONEYBalanceBefore = await xHONEY.balanceOf(borrower.address);

            // liquidateBorrow
            const borrowerBalanceBefore = await nDEW.borrowBalanceStored(borrower.address);
            await expect(nDEW.connect(liquidator).liquidateBorrow(borrower.address, toRepay, xHONEY.address))
                .to.emit(nDEW, "LiquidateBorrow");

            // liquidator adjusted balances
            const liquidatorSeizeTokensUnderlyingAfter = await inv.balanceOf(liquidator.address);
            expect(liquidatorSeizeTokensUnderlyingAfter).to.equal(liquidatorSeizeTokensUnderlyingBefore.add(liquidatorExpectedRedeemedUnderlying));
            
            // collateral tokens of borrower less than before
            expect(await xHONEY.balanceOf(borrower.address)).to.lt(borrowerXHONEYBalanceBefore);
        });
    });
});