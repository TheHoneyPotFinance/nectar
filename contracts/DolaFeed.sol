pragma solidity ^0.5.16;

interface IFeed {
    function decimals() external view returns (uint8);
    function latestAnswer() external view returns (uint);
}

contract DewFeed is IFeed {

    function decimals() public view returns(uint8) {
        return 18;
    }

    function latestAnswer() public view returns (uint) {
        return 1 ether;
    }

}