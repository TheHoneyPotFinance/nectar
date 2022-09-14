module.exports = async ({
    deployments,
    getNamedAccounts
  }) => {
    console.log("33. Deploy Dew Feed")
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await deploy('DewFeed', {
      from: deployer
    });

  };

  module.exports.tags = ['DewFeed'];