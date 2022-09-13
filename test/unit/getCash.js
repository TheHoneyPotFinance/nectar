const { expect } = require("chai");
const { init, wallets, deployInv, deployXinv, 
    deployComptroller, deployUnitroller, 
    supportMarket } = require('../util/xinv');

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
    
    describe('get cash', () => {
        
        it('gets cash prior', async () => {
            await supportMarket(xHONEY.address, unitroller.address);
            const cash = await xHONEY.getCash();
            expect(cash).to.be.equal(0);
        });
    });
});