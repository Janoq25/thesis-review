import { AzureChatOpenAI, AzureOpenAIEmbeddings } from '@langchain/openai';
import { AzureOpenAI } from 'openai';

function instanceName(): string {
  if (process.env.AZURE_OPENAI_API_INSTANCE_NAME) {
    return process.env.AZURE_OPENAI_API_INSTANCE_NAME;
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!endpoint) {
    throw new Error('AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_INSTANCE_NAME is required');
  }
  return new URL(endpoint).hostname.split('.')[0];
}

export function createAzureChatLLM(deployment?: string): AzureChatOpenAI {
  return new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: instanceName(),
    azureOpenAIApiDeploymentName:
      deployment ??
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
      'gpt-4o',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview',
    temperature: 0,
    modelKwargs: { response_format: { type: 'json_object' } },
  });
}

export function createAzureEmbeddings(): AzureOpenAIEmbeddings {
  return new AzureOpenAIEmbeddings({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: instanceName(),
    azureOpenAIApiDeploymentName:
      process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT ??
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ??
      'text-embedding-3-large',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview',
  });
}

export function createAzureOpenAIClient(): AzureOpenAI {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview',
  });
}
