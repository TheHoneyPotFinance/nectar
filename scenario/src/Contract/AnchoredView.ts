import {Contract} from '../Contract';
import {Callable} from '../Invokation';

interface NectaredViewMethods {
  getUnderlyingPrice(asset: string): Callable<number>
}

export interface NectaredView extends Contract {
  methods: NectaredViewMethods
}
