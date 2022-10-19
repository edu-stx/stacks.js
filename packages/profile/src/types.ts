/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface PublicPersonProfile {
  '@context'?: string;
  '@type'?: string;
  '@id'?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  description?: string;
  image?: {
    '@type'?: string;
    name?: string;
    contentUrl?: string;
    [k: string]: unknown;
  }[];
  website?: {
    '@type'?: string;
    url?: string;
    [k: string]: unknown;
  }[];
  account?: {
    '@type'?: string;
    service?: string;
    identifier?: string;
    proofType?: string;
    proofUrl?: string;
    proofMessage?: string;
    proofSignature?: string;
    [k: string]: unknown;
  }[];
  worksFor?: {
    '@type'?: string;
    '@id'?: string;
    [k: string]: unknown;
  }[];
  knows?: {
    '@type'?: string;
    '@id'?: string;
    [k: string]: unknown;
  }[];
  address?: {
    '@type'?: string;
    streetAddress?: string;
    addressLocality?: string;
    postalCode?: string;
    addressCountry?: string;
    [k: string]: unknown;
  };
  birthDate?: string;
  taxID?: string;
  [k: string]: unknown;
}
