declare module "eosio-wasm-js/serialize.js" {
  interface EosioWasmSerializers {
    [type: string]: (value: any) => string;
    actions: (value: any) => string;
  }

  const serialize: EosioWasmSerializers;

  export default serialize;
}

declare module "eosio-wasm-js/transaction_header.js" {
  interface TransactionHeader {
    expiration: number;
    ref_block_num: number;
    ref_block_prefix: number;
    max_net_usage_words: number;
    max_cpu_usage_ms: number;
    delay_sec: number;
  }

  const serialize_transaction_header: (
    transaction: TransactionHeader
  ) => string;

  export default serialize_transaction_header;
}

declare module "eosio-wasm-js/name.js" {
  const serialize_name: (name: string) => string;

  export default serialize_name;
}
