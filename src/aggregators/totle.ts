import _ from "lodash";
import axios from "axios";
import {
  QuoteRequest,
  QuoteResponse,
  Token,
  TradeRequest,
  TradeResponse
} from "./types";

const TOTLE_BASE_URL = "https://api.totle.com";

interface TokenResponse {
  [key: string]: Token;
}

// fetchQuote types

interface TotleQuoteRequest extends QuoteRequest {
  includeTransaction: boolean;
  slippage?: number;
  userAddress?: string;
}

interface TotleTradeOrder {
  splitPercentage: string;
  sourceAsset: Token;
  sourceAmount: string;
  destinationAsset: Token;
  destinationAmount: string;
  rate: string;
  fee: {
    amount: string;
    percent: string;
    asset: Token;
  };
  exchange: {
    id: number;
    name: string;
  };
}

interface TotleTrade {
  sourceAsset: Token;
  sourceAmount: string;
  destinationAsset: Token;
  destinationAmount: string;
  rate: string;
  orders: Array<TotleTradeOrder>;
  runnerUpOrders: [];
}

interface TotleQuoteSummary {
  sourceAsset: {
    address: string;
    symbol: string;
    decimals: string;
  };
  sourceAmount: string;
  destinationAsset: {
    address: string;
    symbol: string;
    decimals: string;
  };
  destinationAmount: string;
  rate: string;
  path: Array<Token>;
  guaranteedRate: string;
  market: {
    rate: string;
    slippage: string;
  };
  trades: Array<TotleTrade>;
}

interface TotleQuote {
  success: boolean;
  response: {
    id: string;
    summary: Array<TotleQuoteSummary>;
    expiration: {
      blockNumber: number;
      estimatedTimestamp: number;
    };
    transactions: any;
  };
}

function buildTotleRequest({
  sourceToken,
  destinationToken,
  sourceAmount,
  includeTransaction,
  slippage,
  userAddress
}) {
  return {
    swaps: [
      {
        sourceAsset: sourceToken,
        destinationAsset: destinationToken,
        sourceAmount: sourceAmount,
        // maxMarketSlippagePercent: "10",
        maxExecutionSlippagePercent: `${slippage}`
      }
    ],
    config: {
      strategy: {
        main: "curves",
        backup: "curves"
      },
      skipBalanceChecks: false,
      transactions: includeTransaction
    },
    address: userAddress,
    apiKey: "41a14d82-36b0-457e-8c16-b86f2f19d094"
  };
}

class Totle {
  tokensReady: Promise<Token[]>;
  constructor(network: number) {
    if (network !== 1) {
      throw new Error("only mainnet is supported");
    }
    this.tokensReady = this.fetchTokens();
  }
  async fetchTokens(): Promise<Token[]> {
    const tokenResponse = await axios
      .get(`${TOTLE_BASE_URL}/tokens`)
      .then(resp => resp.data);

    return tokenResponse.tokens.map(t => ({
      ...t,
      address: t.address.toLowerCase()
    }));
  }
  async _fetchTotleQuote({
    sourceToken,
    destinationToken,
    sourceAmount,
    includeTransaction,
    slippage,
    userAddress
  }: TotleQuoteRequest): Promise<TotleQuote> {
    const totleRequest = buildTotleRequest({
      sourceToken,
      destinationToken,
      sourceAmount,
      includeTransaction,
      userAddress,
      slippage
    });

    return await axios
      .post("https://api.totle.com/swap", totleRequest)
      .then(resp => resp.data);
  }
  async fetchQuote({
    sourceToken,
    destinationToken,
    sourceAmount
  }: QuoteRequest): Promise<QuoteResponse> {
    const quote: TotleQuote = await this._fetchTotleQuote({
      sourceToken,
      destinationToken,
      sourceAmount,
      includeTransaction: false
    });

    return {
      sourceToken,
      destinationToken,
      sourceAmount,
      destinationAmount: quote.response.summary[0].destinationAmount
    };
  }
  async fetchTrade({
    sourceToken,
    destinationToken,
    sourceAmount,
    userAddress,
    slippage
  }: TradeRequest): Promise<TradeResponse> {
    const quote: TotleQuote = await this._fetchTotleQuote({
      sourceToken,
      destinationToken,
      sourceAmount,
      includeTransaction: true,
      slippage,
      userAddress
    });

    const { to, data, value } = quote.response.transactions.find(
      t => t.type === "swap"
    ).tx;

    return {
      sourceToken,
      destinationToken,
      sourceAmount,
      destinationAmount: quote.response.summary[0].destinationAmount,
      from: userAddress,
      to,
      data,
      value
    };
  }
}

export default Totle;
