module.exports = async ({
    deployments,
    getNamedAccounts,
  }) => {
    console.log("9. Set Dew fixed price")
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts()

    await execute('Oracle', {
        from: deployer,
    },
        "setFixedPrice",
        (await deployments.get('nDew')).address,
        "1000000000000000000"
    )
    return true
  };
module.exports.id = 'setDewPrice';
module.exports.tags = ['setDewPrice'];
module.exports.dependencies = ['Oracle', 'nDew'];