import {Event} from '../Event';
import {World} from '../World';
import {NectaredView} from '../Contract/NectaredView';
import {getAddressV} from '../CoreValue';
import {AddressV, NumberV, Value} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getNectaredView} from '../ContractLookup';

export async function getNectaredViewAddress(_: World, anchoredView: NectaredView): Promise<AddressV> {
  return new AddressV(anchoredView._address);
}

async function getUnderlyingPrice(_: World, anchoredView: NectaredView, asset: string): Promise<NumberV> {
  return new NumberV(await anchoredView.methods.getUnderlyingPrice(asset).call());
}

export function anchoredViewFetchers() {
  return [
    new Fetcher<{anchoredView: NectaredView, asset: AddressV}, NumberV>(`
        #### UnderlyingPrice

        * "UnderlyingPrice asset:<Address>" - Gets the price of the given asset
      `,
      "UnderlyingPrice",
      [
        new Arg("anchoredView", getNectaredView, {implicit: true}),
        new Arg("asset", getAddressV)
      ],
      (world, {anchoredView, asset}) => getUnderlyingPrice(world, anchoredView, asset.val)
    )
  ];
}

export async function getNectaredViewValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("NectaredView", anchoredViewFetchers(), world, event);
}
