import { z } from 'zod';
import type { Prisma } from '../prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const UserScalarFieldEnumSchema = z.enum(['id','primaryEmail','createdAt','updatedAt']);

export const AuthIdentityScalarFieldEnumSchema = z.enum(['id','userId','provider','subject','linkedAt','verifiedAt','disabledAt','createdAt','updatedAt']);

export const CollectionScalarFieldEnumSchema = z.enum(['id','name','description','personalIdNumber','professionalIdNumber','instructions','year','createdAt','updatedAt','deletedAt','userId']);

export const BillHeaderScalarFieldEnumSchema = z.enum(['id','number','name','description','buyerName','idBuyer','totalWithoutTaxes','taxes','totalAmount','comercialName','socialName','idSeller','addressMatriz','fileType','billType','storagePath','percentage','reason','createdAt','updatedAt','deletedAt','collectionId']);

export const BillDetailScalarFieldEnumSchema = z.enum(['id','description','quantity','unitPrice','discount','billId','createdAt','updatedAt','deletedAt']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);

export const AuthProviderSchema = z.enum(['FIREBASE']);

export type AuthProviderType = `${z.infer<typeof AuthProviderSchema>}`

export const BillFileTypeSchema = z.enum(['XML','PDF','TEXT','MARKDOWN']);

export type BillFileTypeType = `${z.infer<typeof BillFileTypeSchema>}`

export const BillTargetTypeSchema = z.enum(['PERSONAL','PROFESSIONAL','OTHER']);

export type BillTargetTypeType = `${z.infer<typeof BillTargetTypeSchema>}`

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  id: z.uuid(),
  primaryEmail: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// AUTH IDENTITY SCHEMA
/////////////////////////////////////////

export const AuthIdentitySchema = z.object({
  provider: AuthProviderSchema,
  id: z.uuid(),
  userId: z.string(),
  subject: z.string(),
  linkedAt: z.coerce.date(),
  verifiedAt: z.coerce.date().nullable(),
  disabledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type AuthIdentity = z.infer<typeof AuthIdentitySchema>

/////////////////////////////////////////
// COLLECTION SCHEMA
/////////////////////////////////////////

export const CollectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  userId: z.string(),
})

export type Collection = z.infer<typeof CollectionSchema>

/////////////////////////////////////////
// BILL HEADER SCHEMA
/////////////////////////////////////////

export const BillHeaderSchema = z.object({
  fileType: BillFileTypeSchema,
  billType: BillTargetTypeSchema,
  id: z.uuid(),
  number: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  storagePath: z.string(),
  percentage: z.number().nullable(),
  reason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
  collectionId: z.string(),
})

export type BillHeader = z.infer<typeof BillHeaderSchema>

/////////////////////////////////////////
// BILL DETAIL SCHEMA
/////////////////////////////////////////

export const BillDetailSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  billId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
})

export type BillDetail = z.infer<typeof BillDetailSchema>

/////////////////////////////////////////
// SELECT & INCLUDE
/////////////////////////////////////////

// USER
//------------------------------------------------------

export const UserIncludeSchema: z.ZodType<Prisma.UserInclude> = z.object({
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  authIdentities: z.union([z.boolean(),z.lazy(() => AuthIdentityFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict();

export const UserArgsSchema: z.ZodType<Prisma.UserDefaultArgs> = z.object({
  select: z.lazy(() => UserSelectSchema).optional(),
  include: z.lazy(() => UserIncludeSchema).optional(),
}).strict();

export const UserCountOutputTypeArgsSchema: z.ZodType<Prisma.UserCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => UserCountOutputTypeSelectSchema).nullish(),
}).strict();

export const UserCountOutputTypeSelectSchema: z.ZodType<Prisma.UserCountOutputTypeSelect> = z.object({
  collections: z.boolean().optional(),
  authIdentities: z.boolean().optional(),
}).strict();

export const UserSelectSchema: z.ZodType<Prisma.UserSelect> = z.object({
  id: z.boolean().optional(),
  primaryEmail: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  collections: z.union([z.boolean(),z.lazy(() => CollectionFindManyArgsSchema)]).optional(),
  authIdentities: z.union([z.boolean(),z.lazy(() => AuthIdentityFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => UserCountOutputTypeArgsSchema)]).optional(),
}).strict()

// AUTH IDENTITY
//------------------------------------------------------

export const AuthIdentityIncludeSchema: z.ZodType<Prisma.AuthIdentityInclude> = z.object({
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict();

export const AuthIdentityArgsSchema: z.ZodType<Prisma.AuthIdentityDefaultArgs> = z.object({
  select: z.lazy(() => AuthIdentitySelectSchema).optional(),
  include: z.lazy(() => AuthIdentityIncludeSchema).optional(),
}).strict();

export const AuthIdentitySelectSchema: z.ZodType<Prisma.AuthIdentitySelect> = z.object({
  id: z.boolean().optional(),
  userId: z.boolean().optional(),
  provider: z.boolean().optional(),
  subject: z.boolean().optional(),
  linkedAt: z.boolean().optional(),
  verifiedAt: z.boolean().optional(),
  disabledAt: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
}).strict()

// COLLECTION
//------------------------------------------------------

export const CollectionIncludeSchema: z.ZodType<Prisma.CollectionInclude> = z.object({
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  bills: z.union([z.boolean(),z.lazy(() => BillHeaderFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => CollectionCountOutputTypeArgsSchema)]).optional(),
}).strict();

export const CollectionArgsSchema: z.ZodType<Prisma.CollectionDefaultArgs> = z.object({
  select: z.lazy(() => CollectionSelectSchema).optional(),
  include: z.lazy(() => CollectionIncludeSchema).optional(),
}).strict();

export const CollectionCountOutputTypeArgsSchema: z.ZodType<Prisma.CollectionCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => CollectionCountOutputTypeSelectSchema).nullish(),
}).strict();

export const CollectionCountOutputTypeSelectSchema: z.ZodType<Prisma.CollectionCountOutputTypeSelect> = z.object({
  bills: z.boolean().optional(),
}).strict();

export const CollectionSelectSchema: z.ZodType<Prisma.CollectionSelect> = z.object({
  id: z.boolean().optional(),
  name: z.boolean().optional(),
  description: z.boolean().optional(),
  personalIdNumber: z.boolean().optional(),
  professionalIdNumber: z.boolean().optional(),
  instructions: z.boolean().optional(),
  year: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  deletedAt: z.boolean().optional(),
  userId: z.boolean().optional(),
  user: z.union([z.boolean(),z.lazy(() => UserArgsSchema)]).optional(),
  bills: z.union([z.boolean(),z.lazy(() => BillHeaderFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => CollectionCountOutputTypeArgsSchema)]).optional(),
}).strict()

// BILL HEADER
//------------------------------------------------------

export const BillHeaderIncludeSchema: z.ZodType<Prisma.BillHeaderInclude> = z.object({
  collection: z.union([z.boolean(),z.lazy(() => CollectionArgsSchema)]).optional(),
  details: z.union([z.boolean(),z.lazy(() => BillDetailFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => BillHeaderCountOutputTypeArgsSchema)]).optional(),
}).strict();

export const BillHeaderArgsSchema: z.ZodType<Prisma.BillHeaderDefaultArgs> = z.object({
  select: z.lazy(() => BillHeaderSelectSchema).optional(),
  include: z.lazy(() => BillHeaderIncludeSchema).optional(),
}).strict();

export const BillHeaderCountOutputTypeArgsSchema: z.ZodType<Prisma.BillHeaderCountOutputTypeDefaultArgs> = z.object({
  select: z.lazy(() => BillHeaderCountOutputTypeSelectSchema).nullish(),
}).strict();

export const BillHeaderCountOutputTypeSelectSchema: z.ZodType<Prisma.BillHeaderCountOutputTypeSelect> = z.object({
  details: z.boolean().optional(),
}).strict();

export const BillHeaderSelectSchema: z.ZodType<Prisma.BillHeaderSelect> = z.object({
  id: z.boolean().optional(),
  number: z.boolean().optional(),
  name: z.boolean().optional(),
  description: z.boolean().optional(),
  buyerName: z.boolean().optional(),
  idBuyer: z.boolean().optional(),
  totalWithoutTaxes: z.boolean().optional(),
  taxes: z.boolean().optional(),
  totalAmount: z.boolean().optional(),
  comercialName: z.boolean().optional(),
  socialName: z.boolean().optional(),
  idSeller: z.boolean().optional(),
  addressMatriz: z.boolean().optional(),
  fileType: z.boolean().optional(),
  billType: z.boolean().optional(),
  storagePath: z.boolean().optional(),
  percentage: z.boolean().optional(),
  reason: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  deletedAt: z.boolean().optional(),
  collectionId: z.boolean().optional(),
  collection: z.union([z.boolean(),z.lazy(() => CollectionArgsSchema)]).optional(),
  details: z.union([z.boolean(),z.lazy(() => BillDetailFindManyArgsSchema)]).optional(),
  _count: z.union([z.boolean(),z.lazy(() => BillHeaderCountOutputTypeArgsSchema)]).optional(),
}).strict()

// BILL DETAIL
//------------------------------------------------------

export const BillDetailIncludeSchema: z.ZodType<Prisma.BillDetailInclude> = z.object({
  bill: z.union([z.boolean(),z.lazy(() => BillHeaderArgsSchema)]).optional(),
}).strict();

export const BillDetailArgsSchema: z.ZodType<Prisma.BillDetailDefaultArgs> = z.object({
  select: z.lazy(() => BillDetailSelectSchema).optional(),
  include: z.lazy(() => BillDetailIncludeSchema).optional(),
}).strict();

export const BillDetailSelectSchema: z.ZodType<Prisma.BillDetailSelect> = z.object({
  id: z.boolean().optional(),
  description: z.boolean().optional(),
  quantity: z.boolean().optional(),
  unitPrice: z.boolean().optional(),
  discount: z.boolean().optional(),
  billId: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  deletedAt: z.boolean().optional(),
  bill: z.union([z.boolean(),z.lazy(() => BillHeaderArgsSchema)]).optional(),
}).strict()


/////////////////////////////////////////
// INPUT TYPES
/////////////////////////////////////////

export const UserWhereInputSchema: z.ZodType<Prisma.UserWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  primaryEmail: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  collections: z.lazy(() => CollectionListRelationFilterSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityListRelationFilterSchema).optional(),
});

export const UserOrderByWithRelationInputSchema: z.ZodType<Prisma.UserOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  primaryEmail: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  collections: z.lazy(() => CollectionOrderByRelationAggregateInputSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityOrderByRelationAggregateInputSchema).optional(),
});

export const UserWhereUniqueInputSchema: z.ZodType<Prisma.UserWhereUniqueInput> = z.object({
  id: z.uuid(),
})
.and(z.strictObject({
  id: z.uuid().optional(),
  AND: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema), z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  primaryEmail: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  collections: z.lazy(() => CollectionListRelationFilterSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityListRelationFilterSchema).optional(),
}));

export const UserOrderByWithAggregationInputSchema: z.ZodType<Prisma.UserOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  primaryEmail: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => UserCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => UserMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => UserMinOrderByAggregateInputSchema).optional(),
});

export const UserScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.UserScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema), z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserScalarWhereWithAggregatesInputSchema), z.lazy(() => UserScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  primaryEmail: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
});

export const AuthIdentityWhereInputSchema: z.ZodType<Prisma.AuthIdentityWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => AuthIdentityWhereInputSchema), z.lazy(() => AuthIdentityWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => AuthIdentityWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => AuthIdentityWhereInputSchema), z.lazy(() => AuthIdentityWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  provider: z.union([ z.lazy(() => EnumAuthProviderFilterSchema), z.lazy(() => AuthProviderSchema) ]).optional(),
  subject: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  linkedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  verifiedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  disabledAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
});

export const AuthIdentityOrderByWithRelationInputSchema: z.ZodType<Prisma.AuthIdentityOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  provider: z.lazy(() => SortOrderSchema).optional(),
  subject: z.lazy(() => SortOrderSchema).optional(),
  linkedAt: z.lazy(() => SortOrderSchema).optional(),
  verifiedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  disabledAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
});

export const AuthIdentityWhereUniqueInputSchema: z.ZodType<Prisma.AuthIdentityWhereUniqueInput> = z.union([
  z.object({
    id: z.uuid(),
    auth_identity_provider_subject_key: z.lazy(() => AuthIdentityAuth_identity_provider_subject_keyCompoundUniqueInputSchema),
  }),
  z.object({
    id: z.uuid(),
  }),
  z.object({
    auth_identity_provider_subject_key: z.lazy(() => AuthIdentityAuth_identity_provider_subject_keyCompoundUniqueInputSchema),
  }),
])
.and(z.strictObject({
  id: z.uuid().optional(),
  auth_identity_provider_subject_key: z.lazy(() => AuthIdentityAuth_identity_provider_subject_keyCompoundUniqueInputSchema).optional(),
  AND: z.union([ z.lazy(() => AuthIdentityWhereInputSchema), z.lazy(() => AuthIdentityWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => AuthIdentityWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => AuthIdentityWhereInputSchema), z.lazy(() => AuthIdentityWhereInputSchema).array() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  provider: z.union([ z.lazy(() => EnumAuthProviderFilterSchema), z.lazy(() => AuthProviderSchema) ]).optional(),
  subject: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  linkedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  verifiedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  disabledAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
}));

export const AuthIdentityOrderByWithAggregationInputSchema: z.ZodType<Prisma.AuthIdentityOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  provider: z.lazy(() => SortOrderSchema).optional(),
  subject: z.lazy(() => SortOrderSchema).optional(),
  linkedAt: z.lazy(() => SortOrderSchema).optional(),
  verifiedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  disabledAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => AuthIdentityCountOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => AuthIdentityMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => AuthIdentityMinOrderByAggregateInputSchema).optional(),
});

export const AuthIdentityScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.AuthIdentityScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => AuthIdentityScalarWhereWithAggregatesInputSchema), z.lazy(() => AuthIdentityScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => AuthIdentityScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => AuthIdentityScalarWhereWithAggregatesInputSchema), z.lazy(() => AuthIdentityScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  provider: z.union([ z.lazy(() => EnumAuthProviderWithAggregatesFilterSchema), z.lazy(() => AuthProviderSchema) ]).optional(),
  subject: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  linkedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  verifiedAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema), z.coerce.date() ]).optional().nullable(),
  disabledAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema), z.coerce.date() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
});

export const CollectionWhereInputSchema: z.ZodType<Prisma.CollectionWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CollectionWhereInputSchema), z.lazy(() => CollectionWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CollectionWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CollectionWhereInputSchema), z.lazy(() => CollectionWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  personalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  professionalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  instructions: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
  bills: z.lazy(() => BillHeaderListRelationFilterSchema).optional(),
});

export const CollectionOrderByWithRelationInputSchema: z.ZodType<Prisma.CollectionOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  personalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  professionalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  instructions: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputSchema).optional(),
  bills: z.lazy(() => BillHeaderOrderByRelationAggregateInputSchema).optional(),
});

export const CollectionWhereUniqueInputSchema: z.ZodType<Prisma.CollectionWhereUniqueInput> = z.object({
  id: z.uuid(),
})
.and(z.strictObject({
  id: z.uuid().optional(),
  AND: z.union([ z.lazy(() => CollectionWhereInputSchema), z.lazy(() => CollectionWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CollectionWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CollectionWhereInputSchema), z.lazy(() => CollectionWhereInputSchema).array() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  personalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  professionalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  instructions: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntFilterSchema), z.number().int() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  user: z.union([ z.lazy(() => UserScalarRelationFilterSchema), z.lazy(() => UserWhereInputSchema) ]).optional(),
  bills: z.lazy(() => BillHeaderListRelationFilterSchema).optional(),
}));

export const CollectionOrderByWithAggregationInputSchema: z.ZodType<Prisma.CollectionOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  personalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  professionalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  instructions: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => CollectionCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => CollectionAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => CollectionMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => CollectionMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => CollectionSumOrderByAggregateInputSchema).optional(),
});

export const CollectionScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.CollectionScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema), z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema), z.lazy(() => CollectionScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  personalIdNumber: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  professionalIdNumber: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  instructions: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntWithAggregatesFilterSchema), z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema), z.coerce.date() ]).optional().nullable(),
  userId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
});

export const BillHeaderWhereInputSchema: z.ZodType<Prisma.BillHeaderWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillHeaderWhereInputSchema), z.lazy(() => BillHeaderWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillHeaderWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillHeaderWhereInputSchema), z.lazy(() => BillHeaderWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  number: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  buyerName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idBuyer: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  totalWithoutTaxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  taxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  totalAmount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  comercialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  socialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idSeller: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  addressMatriz: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  fileType: z.union([ z.lazy(() => EnumBillFileTypeFilterSchema), z.lazy(() => BillFileTypeSchema) ]).optional(),
  billType: z.union([ z.lazy(() => EnumBillTargetTypeFilterSchema), z.lazy(() => BillTargetTypeSchema) ]).optional(),
  storagePath: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  percentage: z.union([ z.lazy(() => FloatNullableFilterSchema), z.number() ]).optional().nullable(),
  reason: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  collectionId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  collection: z.union([ z.lazy(() => CollectionScalarRelationFilterSchema), z.lazy(() => CollectionWhereInputSchema) ]).optional(),
  details: z.lazy(() => BillDetailListRelationFilterSchema).optional(),
});

export const BillHeaderOrderByWithRelationInputSchema: z.ZodType<Prisma.BillHeaderOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  number: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  buyerName: z.lazy(() => SortOrderSchema).optional(),
  idBuyer: z.lazy(() => SortOrderSchema).optional(),
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  comercialName: z.lazy(() => SortOrderSchema).optional(),
  socialName: z.lazy(() => SortOrderSchema).optional(),
  idSeller: z.lazy(() => SortOrderSchema).optional(),
  addressMatriz: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  billType: z.lazy(() => SortOrderSchema).optional(),
  storagePath: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  reason: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  collectionId: z.lazy(() => SortOrderSchema).optional(),
  collection: z.lazy(() => CollectionOrderByWithRelationInputSchema).optional(),
  details: z.lazy(() => BillDetailOrderByRelationAggregateInputSchema).optional(),
});

export const BillHeaderWhereUniqueInputSchema: z.ZodType<Prisma.BillHeaderWhereUniqueInput> = z.object({
  id: z.uuid(),
})
.and(z.strictObject({
  id: z.uuid().optional(),
  AND: z.union([ z.lazy(() => BillHeaderWhereInputSchema), z.lazy(() => BillHeaderWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillHeaderWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillHeaderWhereInputSchema), z.lazy(() => BillHeaderWhereInputSchema).array() ]).optional(),
  number: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  buyerName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idBuyer: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  totalWithoutTaxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  taxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  totalAmount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  comercialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  socialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idSeller: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  addressMatriz: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  fileType: z.union([ z.lazy(() => EnumBillFileTypeFilterSchema), z.lazy(() => BillFileTypeSchema) ]).optional(),
  billType: z.union([ z.lazy(() => EnumBillTargetTypeFilterSchema), z.lazy(() => BillTargetTypeSchema) ]).optional(),
  storagePath: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  percentage: z.union([ z.lazy(() => FloatNullableFilterSchema), z.number() ]).optional().nullable(),
  reason: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  collectionId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  collection: z.union([ z.lazy(() => CollectionScalarRelationFilterSchema), z.lazy(() => CollectionWhereInputSchema) ]).optional(),
  details: z.lazy(() => BillDetailListRelationFilterSchema).optional(),
}));

export const BillHeaderOrderByWithAggregationInputSchema: z.ZodType<Prisma.BillHeaderOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  number: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  buyerName: z.lazy(() => SortOrderSchema).optional(),
  idBuyer: z.lazy(() => SortOrderSchema).optional(),
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  comercialName: z.lazy(() => SortOrderSchema).optional(),
  socialName: z.lazy(() => SortOrderSchema).optional(),
  idSeller: z.lazy(() => SortOrderSchema).optional(),
  addressMatriz: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  billType: z.lazy(() => SortOrderSchema).optional(),
  storagePath: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  reason: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  collectionId: z.lazy(() => SortOrderSchema).optional(),
  _count: z.lazy(() => BillHeaderCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => BillHeaderAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => BillHeaderMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => BillHeaderMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => BillHeaderSumOrderByAggregateInputSchema).optional(),
});

export const BillHeaderScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.BillHeaderScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillHeaderScalarWhereWithAggregatesInputSchema), z.lazy(() => BillHeaderScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillHeaderScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillHeaderScalarWhereWithAggregatesInputSchema), z.lazy(() => BillHeaderScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  number: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  buyerName: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  idBuyer: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  totalWithoutTaxes: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema), z.number() ]).optional(),
  taxes: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema), z.number() ]).optional(),
  totalAmount: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema), z.number() ]).optional(),
  comercialName: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  socialName: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  idSeller: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  addressMatriz: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  fileType: z.union([ z.lazy(() => EnumBillFileTypeWithAggregatesFilterSchema), z.lazy(() => BillFileTypeSchema) ]).optional(),
  billType: z.union([ z.lazy(() => EnumBillTargetTypeWithAggregatesFilterSchema), z.lazy(() => BillTargetTypeSchema) ]).optional(),
  storagePath: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  percentage: z.union([ z.lazy(() => FloatNullableWithAggregatesFilterSchema), z.number() ]).optional().nullable(),
  reason: z.union([ z.lazy(() => StringNullableWithAggregatesFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema), z.coerce.date() ]).optional().nullable(),
  collectionId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
});

export const BillDetailWhereInputSchema: z.ZodType<Prisma.BillDetailWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillDetailWhereInputSchema), z.lazy(() => BillDetailWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillDetailWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillDetailWhereInputSchema), z.lazy(() => BillDetailWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  quantity: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  unitPrice: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  discount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  billId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  bill: z.union([ z.lazy(() => BillHeaderScalarRelationFilterSchema), z.lazy(() => BillHeaderWhereInputSchema) ]).optional(),
});

export const BillDetailOrderByWithRelationInputSchema: z.ZodType<Prisma.BillDetailOrderByWithRelationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
  billId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  bill: z.lazy(() => BillHeaderOrderByWithRelationInputSchema).optional(),
});

export const BillDetailWhereUniqueInputSchema: z.ZodType<Prisma.BillDetailWhereUniqueInput> = z.object({
  id: z.uuid(),
})
.and(z.strictObject({
  id: z.uuid().optional(),
  AND: z.union([ z.lazy(() => BillDetailWhereInputSchema), z.lazy(() => BillDetailWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillDetailWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillDetailWhereInputSchema), z.lazy(() => BillDetailWhereInputSchema).array() ]).optional(),
  description: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  quantity: z.union([ z.lazy(() => IntFilterSchema), z.number().int() ]).optional(),
  unitPrice: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  discount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  billId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  bill: z.union([ z.lazy(() => BillHeaderScalarRelationFilterSchema), z.lazy(() => BillHeaderWhereInputSchema) ]).optional(),
}));

export const BillDetailOrderByWithAggregationInputSchema: z.ZodType<Prisma.BillDetailOrderByWithAggregationInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
  billId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.union([ z.lazy(() => SortOrderSchema), z.lazy(() => SortOrderInputSchema) ]).optional(),
  _count: z.lazy(() => BillDetailCountOrderByAggregateInputSchema).optional(),
  _avg: z.lazy(() => BillDetailAvgOrderByAggregateInputSchema).optional(),
  _max: z.lazy(() => BillDetailMaxOrderByAggregateInputSchema).optional(),
  _min: z.lazy(() => BillDetailMinOrderByAggregateInputSchema).optional(),
  _sum: z.lazy(() => BillDetailSumOrderByAggregateInputSchema).optional(),
});

export const BillDetailScalarWhereWithAggregatesInputSchema: z.ZodType<Prisma.BillDetailScalarWhereWithAggregatesInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillDetailScalarWhereWithAggregatesInputSchema), z.lazy(() => BillDetailScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillDetailScalarWhereWithAggregatesInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillDetailScalarWhereWithAggregatesInputSchema), z.lazy(() => BillDetailScalarWhereWithAggregatesInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  quantity: z.union([ z.lazy(() => IntWithAggregatesFilterSchema), z.number() ]).optional(),
  unitPrice: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema), z.number() ]).optional(),
  discount: z.union([ z.lazy(() => FloatWithAggregatesFilterSchema), z.number() ]).optional(),
  billId: z.union([ z.lazy(() => StringWithAggregatesFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeWithAggregatesFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableWithAggregatesFilterSchema), z.coerce.date() ]).optional().nullable(),
});

export const UserCreateInputSchema: z.ZodType<Prisma.UserCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  collections: z.lazy(() => CollectionCreateNestedManyWithoutUserInputSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUncheckedCreateInputSchema: z.ZodType<Prisma.UserUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  collections: z.lazy(() => CollectionUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUpdateInputSchema: z.ZodType<Prisma.UserUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  collections: z.lazy(() => CollectionUpdateManyWithoutUserNestedInputSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserUncheckedUpdateInputSchema: z.ZodType<Prisma.UserUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  collections: z.lazy(() => CollectionUncheckedUpdateManyWithoutUserNestedInputSchema).optional(),
  authIdentities: z.lazy(() => AuthIdentityUncheckedUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserCreateManyInputSchema: z.ZodType<Prisma.UserCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const UserUpdateManyMutationInputSchema: z.ZodType<Prisma.UserUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const UserUncheckedUpdateManyInputSchema: z.ZodType<Prisma.UserUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const AuthIdentityCreateInputSchema: z.ZodType<Prisma.AuthIdentityCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  user: z.lazy(() => UserCreateNestedOneWithoutAuthIdentitiesInputSchema),
});

export const AuthIdentityUncheckedCreateInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  userId: z.string(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const AuthIdentityUpdateInputSchema: z.ZodType<Prisma.AuthIdentityUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutAuthIdentitiesNestedInputSchema).optional(),
});

export const AuthIdentityUncheckedUpdateInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const AuthIdentityCreateManyInputSchema: z.ZodType<Prisma.AuthIdentityCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  userId: z.string(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const AuthIdentityUpdateManyMutationInputSchema: z.ZodType<Prisma.AuthIdentityUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const AuthIdentityUncheckedUpdateManyInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CollectionCreateInputSchema: z.ZodType<Prisma.CollectionCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  user: z.lazy(() => UserCreateNestedOneWithoutCollectionsInputSchema),
  bills: z.lazy(() => BillHeaderCreateNestedManyWithoutCollectionInputSchema).optional(),
});

export const CollectionUncheckedCreateInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  userId: z.string(),
  bills: z.lazy(() => BillHeaderUncheckedCreateNestedManyWithoutCollectionInputSchema).optional(),
});

export const CollectionUpdateInputSchema: z.ZodType<Prisma.CollectionUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutCollectionsNestedInputSchema).optional(),
  bills: z.lazy(() => BillHeaderUpdateManyWithoutCollectionNestedInputSchema).optional(),
});

export const CollectionUncheckedUpdateInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  bills: z.lazy(() => BillHeaderUncheckedUpdateManyWithoutCollectionNestedInputSchema).optional(),
});

export const CollectionCreateManyInputSchema: z.ZodType<Prisma.CollectionCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  userId: z.string(),
});

export const CollectionUpdateManyMutationInputSchema: z.ZodType<Prisma.CollectionUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const CollectionUncheckedUpdateManyInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
});

export const BillHeaderCreateInputSchema: z.ZodType<Prisma.BillHeaderCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  collection: z.lazy(() => CollectionCreateNestedOneWithoutBillsInputSchema),
  details: z.lazy(() => BillDetailCreateNestedManyWithoutBillInputSchema).optional(),
});

export const BillHeaderUncheckedCreateInputSchema: z.ZodType<Prisma.BillHeaderUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  collectionId: z.string(),
  details: z.lazy(() => BillDetailUncheckedCreateNestedManyWithoutBillInputSchema).optional(),
});

export const BillHeaderUpdateInputSchema: z.ZodType<Prisma.BillHeaderUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  collection: z.lazy(() => CollectionUpdateOneRequiredWithoutBillsNestedInputSchema).optional(),
  details: z.lazy(() => BillDetailUpdateManyWithoutBillNestedInputSchema).optional(),
});

export const BillHeaderUncheckedUpdateInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  collectionId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  details: z.lazy(() => BillDetailUncheckedUpdateManyWithoutBillNestedInputSchema).optional(),
});

export const BillHeaderCreateManyInputSchema: z.ZodType<Prisma.BillHeaderCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  collectionId: z.string(),
});

export const BillHeaderUpdateManyMutationInputSchema: z.ZodType<Prisma.BillHeaderUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillHeaderUncheckedUpdateManyInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  collectionId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
});

export const BillDetailCreateInputSchema: z.ZodType<Prisma.BillDetailCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  bill: z.lazy(() => BillHeaderCreateNestedOneWithoutDetailsInputSchema),
});

export const BillDetailUncheckedCreateInputSchema: z.ZodType<Prisma.BillDetailUncheckedCreateInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  billId: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillDetailUpdateInputSchema: z.ZodType<Prisma.BillDetailUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  bill: z.lazy(() => BillHeaderUpdateOneRequiredWithoutDetailsNestedInputSchema).optional(),
});

export const BillDetailUncheckedUpdateInputSchema: z.ZodType<Prisma.BillDetailUncheckedUpdateInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  billId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillDetailCreateManyInputSchema: z.ZodType<Prisma.BillDetailCreateManyInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  billId: z.string(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillDetailUpdateManyMutationInputSchema: z.ZodType<Prisma.BillDetailUpdateManyMutationInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillDetailUncheckedUpdateManyInputSchema: z.ZodType<Prisma.BillDetailUncheckedUpdateManyInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  billId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const StringFilterSchema: z.ZodType<Prisma.StringFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
});

export const StringNullableFilterSchema: z.ZodType<Prisma.StringNullableFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
});

export const DateTimeFilterSchema: z.ZodType<Prisma.DateTimeFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
});

export const CollectionListRelationFilterSchema: z.ZodType<Prisma.CollectionListRelationFilter> = z.strictObject({
  every: z.lazy(() => CollectionWhereInputSchema).optional(),
  some: z.lazy(() => CollectionWhereInputSchema).optional(),
  none: z.lazy(() => CollectionWhereInputSchema).optional(),
});

export const AuthIdentityListRelationFilterSchema: z.ZodType<Prisma.AuthIdentityListRelationFilter> = z.strictObject({
  every: z.lazy(() => AuthIdentityWhereInputSchema).optional(),
  some: z.lazy(() => AuthIdentityWhereInputSchema).optional(),
  none: z.lazy(() => AuthIdentityWhereInputSchema).optional(),
});

export const SortOrderInputSchema: z.ZodType<Prisma.SortOrderInput> = z.strictObject({
  sort: z.lazy(() => SortOrderSchema),
  nulls: z.lazy(() => NullsOrderSchema).optional(),
});

export const CollectionOrderByRelationAggregateInputSchema: z.ZodType<Prisma.CollectionOrderByRelationAggregateInput> = z.strictObject({
  _count: z.lazy(() => SortOrderSchema).optional(),
});

export const AuthIdentityOrderByRelationAggregateInputSchema: z.ZodType<Prisma.AuthIdentityOrderByRelationAggregateInput> = z.strictObject({
  _count: z.lazy(() => SortOrderSchema).optional(),
});

export const UserCountOrderByAggregateInputSchema: z.ZodType<Prisma.UserCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  primaryEmail: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const UserMaxOrderByAggregateInputSchema: z.ZodType<Prisma.UserMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  primaryEmail: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const UserMinOrderByAggregateInputSchema: z.ZodType<Prisma.UserMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  primaryEmail: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const StringWithAggregatesFilterSchema: z.ZodType<Prisma.StringWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const StringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.StringNullableWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  mode: z.lazy(() => QueryModeSchema).optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional(),
});

export const DateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.DateTimeWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional(),
});

export const EnumAuthProviderFilterSchema: z.ZodType<Prisma.EnumAuthProviderFilter> = z.strictObject({
  equals: z.lazy(() => AuthProviderSchema).optional(),
  in: z.lazy(() => AuthProviderSchema).array().optional(),
  notIn: z.lazy(() => AuthProviderSchema).array().optional(),
  not: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => NestedEnumAuthProviderFilterSchema) ]).optional(),
});

export const DateTimeNullableFilterSchema: z.ZodType<Prisma.DateTimeNullableFilter> = z.strictObject({
  equals: z.coerce.date().optional().nullable(),
  in: z.coerce.date().array().optional().nullable(),
  notIn: z.coerce.date().array().optional().nullable(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeNullableFilterSchema) ]).optional().nullable(),
});

export const UserScalarRelationFilterSchema: z.ZodType<Prisma.UserScalarRelationFilter> = z.strictObject({
  is: z.lazy(() => UserWhereInputSchema).optional(),
  isNot: z.lazy(() => UserWhereInputSchema).optional(),
});

export const AuthIdentityAuth_identity_provider_subject_keyCompoundUniqueInputSchema: z.ZodType<Prisma.AuthIdentityAuth_identity_provider_subject_keyCompoundUniqueInput> = z.strictObject({
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
});

export const AuthIdentityCountOrderByAggregateInputSchema: z.ZodType<Prisma.AuthIdentityCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  provider: z.lazy(() => SortOrderSchema).optional(),
  subject: z.lazy(() => SortOrderSchema).optional(),
  linkedAt: z.lazy(() => SortOrderSchema).optional(),
  verifiedAt: z.lazy(() => SortOrderSchema).optional(),
  disabledAt: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const AuthIdentityMaxOrderByAggregateInputSchema: z.ZodType<Prisma.AuthIdentityMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  provider: z.lazy(() => SortOrderSchema).optional(),
  subject: z.lazy(() => SortOrderSchema).optional(),
  linkedAt: z.lazy(() => SortOrderSchema).optional(),
  verifiedAt: z.lazy(() => SortOrderSchema).optional(),
  disabledAt: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const AuthIdentityMinOrderByAggregateInputSchema: z.ZodType<Prisma.AuthIdentityMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
  provider: z.lazy(() => SortOrderSchema).optional(),
  subject: z.lazy(() => SortOrderSchema).optional(),
  linkedAt: z.lazy(() => SortOrderSchema).optional(),
  verifiedAt: z.lazy(() => SortOrderSchema).optional(),
  disabledAt: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const EnumAuthProviderWithAggregatesFilterSchema: z.ZodType<Prisma.EnumAuthProviderWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => AuthProviderSchema).optional(),
  in: z.lazy(() => AuthProviderSchema).array().optional(),
  notIn: z.lazy(() => AuthProviderSchema).array().optional(),
  not: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => NestedEnumAuthProviderWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumAuthProviderFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumAuthProviderFilterSchema).optional(),
});

export const DateTimeNullableWithAggregatesFilterSchema: z.ZodType<Prisma.DateTimeNullableWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional().nullable(),
  in: z.coerce.date().array().optional().nullable(),
  notIn: z.coerce.date().array().optional().nullable(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeNullableFilterSchema).optional(),
});

export const IntFilterSchema: z.ZodType<Prisma.IntFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
});

export const BillHeaderListRelationFilterSchema: z.ZodType<Prisma.BillHeaderListRelationFilter> = z.strictObject({
  every: z.lazy(() => BillHeaderWhereInputSchema).optional(),
  some: z.lazy(() => BillHeaderWhereInputSchema).optional(),
  none: z.lazy(() => BillHeaderWhereInputSchema).optional(),
});

export const BillHeaderOrderByRelationAggregateInputSchema: z.ZodType<Prisma.BillHeaderOrderByRelationAggregateInput> = z.strictObject({
  _count: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionCountOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  personalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  professionalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  instructions: z.lazy(() => SortOrderSchema).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionAvgOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionAvgOrderByAggregateInput> = z.strictObject({
  year: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionMaxOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  personalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  professionalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  instructions: z.lazy(() => SortOrderSchema).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionMinOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  personalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  professionalIdNumber: z.lazy(() => SortOrderSchema).optional(),
  instructions: z.lazy(() => SortOrderSchema).optional(),
  year: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  userId: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionSumOrderByAggregateInputSchema: z.ZodType<Prisma.CollectionSumOrderByAggregateInput> = z.strictObject({
  year: z.lazy(() => SortOrderSchema).optional(),
});

export const IntWithAggregatesFilterSchema: z.ZodType<Prisma.IntWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional(),
});

export const FloatFilterSchema: z.ZodType<Prisma.FloatFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatFilterSchema) ]).optional(),
});

export const EnumBillFileTypeFilterSchema: z.ZodType<Prisma.EnumBillFileTypeFilter> = z.strictObject({
  equals: z.lazy(() => BillFileTypeSchema).optional(),
  in: z.lazy(() => BillFileTypeSchema).array().optional(),
  notIn: z.lazy(() => BillFileTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => NestedEnumBillFileTypeFilterSchema) ]).optional(),
});

export const EnumBillTargetTypeFilterSchema: z.ZodType<Prisma.EnumBillTargetTypeFilter> = z.strictObject({
  equals: z.lazy(() => BillTargetTypeSchema).optional(),
  in: z.lazy(() => BillTargetTypeSchema).array().optional(),
  notIn: z.lazy(() => BillTargetTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => NestedEnumBillTargetTypeFilterSchema) ]).optional(),
});

export const FloatNullableFilterSchema: z.ZodType<Prisma.FloatNullableFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatNullableFilterSchema) ]).optional().nullable(),
});

export const CollectionScalarRelationFilterSchema: z.ZodType<Prisma.CollectionScalarRelationFilter> = z.strictObject({
  is: z.lazy(() => CollectionWhereInputSchema).optional(),
  isNot: z.lazy(() => CollectionWhereInputSchema).optional(),
});

export const BillDetailListRelationFilterSchema: z.ZodType<Prisma.BillDetailListRelationFilter> = z.strictObject({
  every: z.lazy(() => BillDetailWhereInputSchema).optional(),
  some: z.lazy(() => BillDetailWhereInputSchema).optional(),
  none: z.lazy(() => BillDetailWhereInputSchema).optional(),
});

export const BillDetailOrderByRelationAggregateInputSchema: z.ZodType<Prisma.BillDetailOrderByRelationAggregateInput> = z.strictObject({
  _count: z.lazy(() => SortOrderSchema).optional(),
});

export const BillHeaderCountOrderByAggregateInputSchema: z.ZodType<Prisma.BillHeaderCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  number: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  buyerName: z.lazy(() => SortOrderSchema).optional(),
  idBuyer: z.lazy(() => SortOrderSchema).optional(),
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  comercialName: z.lazy(() => SortOrderSchema).optional(),
  socialName: z.lazy(() => SortOrderSchema).optional(),
  idSeller: z.lazy(() => SortOrderSchema).optional(),
  addressMatriz: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  billType: z.lazy(() => SortOrderSchema).optional(),
  storagePath: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.lazy(() => SortOrderSchema).optional(),
  reason: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  collectionId: z.lazy(() => SortOrderSchema).optional(),
});

export const BillHeaderAvgOrderByAggregateInputSchema: z.ZodType<Prisma.BillHeaderAvgOrderByAggregateInput> = z.strictObject({
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.lazy(() => SortOrderSchema).optional(),
});

export const BillHeaderMaxOrderByAggregateInputSchema: z.ZodType<Prisma.BillHeaderMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  number: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  buyerName: z.lazy(() => SortOrderSchema).optional(),
  idBuyer: z.lazy(() => SortOrderSchema).optional(),
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  comercialName: z.lazy(() => SortOrderSchema).optional(),
  socialName: z.lazy(() => SortOrderSchema).optional(),
  idSeller: z.lazy(() => SortOrderSchema).optional(),
  addressMatriz: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  billType: z.lazy(() => SortOrderSchema).optional(),
  storagePath: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.lazy(() => SortOrderSchema).optional(),
  reason: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  collectionId: z.lazy(() => SortOrderSchema).optional(),
});

export const BillHeaderMinOrderByAggregateInputSchema: z.ZodType<Prisma.BillHeaderMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  number: z.lazy(() => SortOrderSchema).optional(),
  name: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  buyerName: z.lazy(() => SortOrderSchema).optional(),
  idBuyer: z.lazy(() => SortOrderSchema).optional(),
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  comercialName: z.lazy(() => SortOrderSchema).optional(),
  socialName: z.lazy(() => SortOrderSchema).optional(),
  idSeller: z.lazy(() => SortOrderSchema).optional(),
  addressMatriz: z.lazy(() => SortOrderSchema).optional(),
  fileType: z.lazy(() => SortOrderSchema).optional(),
  billType: z.lazy(() => SortOrderSchema).optional(),
  storagePath: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.lazy(() => SortOrderSchema).optional(),
  reason: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
  collectionId: z.lazy(() => SortOrderSchema).optional(),
});

export const BillHeaderSumOrderByAggregateInputSchema: z.ZodType<Prisma.BillHeaderSumOrderByAggregateInput> = z.strictObject({
  totalWithoutTaxes: z.lazy(() => SortOrderSchema).optional(),
  taxes: z.lazy(() => SortOrderSchema).optional(),
  totalAmount: z.lazy(() => SortOrderSchema).optional(),
  percentage: z.lazy(() => SortOrderSchema).optional(),
});

export const FloatWithAggregatesFilterSchema: z.ZodType<Prisma.FloatWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatFilterSchema).optional(),
});

export const EnumBillFileTypeWithAggregatesFilterSchema: z.ZodType<Prisma.EnumBillFileTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => BillFileTypeSchema).optional(),
  in: z.lazy(() => BillFileTypeSchema).array().optional(),
  notIn: z.lazy(() => BillFileTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => NestedEnumBillFileTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumBillFileTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumBillFileTypeFilterSchema).optional(),
});

export const EnumBillTargetTypeWithAggregatesFilterSchema: z.ZodType<Prisma.EnumBillTargetTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => BillTargetTypeSchema).optional(),
  in: z.lazy(() => BillTargetTypeSchema).array().optional(),
  notIn: z.lazy(() => BillTargetTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => NestedEnumBillTargetTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumBillTargetTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumBillTargetTypeFilterSchema).optional(),
});

export const FloatNullableWithAggregatesFilterSchema: z.ZodType<Prisma.FloatNullableWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
});

export const BillHeaderScalarRelationFilterSchema: z.ZodType<Prisma.BillHeaderScalarRelationFilter> = z.strictObject({
  is: z.lazy(() => BillHeaderWhereInputSchema).optional(),
  isNot: z.lazy(() => BillHeaderWhereInputSchema).optional(),
});

export const BillDetailCountOrderByAggregateInputSchema: z.ZodType<Prisma.BillDetailCountOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
  billId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const BillDetailAvgOrderByAggregateInputSchema: z.ZodType<Prisma.BillDetailAvgOrderByAggregateInput> = z.strictObject({
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
});

export const BillDetailMaxOrderByAggregateInputSchema: z.ZodType<Prisma.BillDetailMaxOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
  billId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const BillDetailMinOrderByAggregateInputSchema: z.ZodType<Prisma.BillDetailMinOrderByAggregateInput> = z.strictObject({
  id: z.lazy(() => SortOrderSchema).optional(),
  description: z.lazy(() => SortOrderSchema).optional(),
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
  billId: z.lazy(() => SortOrderSchema).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  deletedAt: z.lazy(() => SortOrderSchema).optional(),
});

export const BillDetailSumOrderByAggregateInputSchema: z.ZodType<Prisma.BillDetailSumOrderByAggregateInput> = z.strictObject({
  quantity: z.lazy(() => SortOrderSchema).optional(),
  unitPrice: z.lazy(() => SortOrderSchema).optional(),
  discount: z.lazy(() => SortOrderSchema).optional(),
});

export const CollectionCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.CollectionCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionCreateWithoutUserInputSchema).array(), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema), z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
});

export const AuthIdentityCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateWithoutUserInputSchema).array(), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AuthIdentityCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
});

export const CollectionUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionCreateWithoutUserInputSchema).array(), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema), z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
});

export const AuthIdentityUncheckedCreateNestedManyWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedCreateNestedManyWithoutUserInput> = z.strictObject({
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateWithoutUserInputSchema).array(), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AuthIdentityCreateManyUserInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
});

export const StringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.StringFieldUpdateOperationsInput> = z.strictObject({
  set: z.string().optional(),
});

export const NullableStringFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableStringFieldUpdateOperationsInput> = z.strictObject({
  set: z.string().optional().nullable(),
});

export const DateTimeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.DateTimeFieldUpdateOperationsInput> = z.strictObject({
  set: z.coerce.date().optional(),
});

export const CollectionUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionCreateWithoutUserInputSchema).array(), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema), z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CollectionUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CollectionUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CollectionUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CollectionUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => CollectionUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CollectionScalarWhereInputSchema), z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
});

export const AuthIdentityUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.AuthIdentityUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateWithoutUserInputSchema).array(), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => AuthIdentityUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => AuthIdentityUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AuthIdentityCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => AuthIdentityUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => AuthIdentityUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => AuthIdentityUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => AuthIdentityUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => AuthIdentityScalarWhereInputSchema), z.lazy(() => AuthIdentityScalarWhereInputSchema).array() ]).optional(),
});

export const CollectionUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionCreateWithoutUserInputSchema).array(), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema), z.lazy(() => CollectionCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => CollectionUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CollectionUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => CollectionCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => CollectionWhereUniqueInputSchema), z.lazy(() => CollectionWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => CollectionUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => CollectionUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => CollectionUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => CollectionScalarWhereInputSchema), z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
});

export const AuthIdentityUncheckedUpdateManyWithoutUserNestedInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedUpdateManyWithoutUserNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateWithoutUserInputSchema).array(), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema), z.lazy(() => AuthIdentityCreateOrConnectWithoutUserInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => AuthIdentityUpsertWithWhereUniqueWithoutUserInputSchema), z.lazy(() => AuthIdentityUpsertWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  createMany: z.lazy(() => AuthIdentityCreateManyUserInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => AuthIdentityWhereUniqueInputSchema), z.lazy(() => AuthIdentityWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => AuthIdentityUpdateWithWhereUniqueWithoutUserInputSchema), z.lazy(() => AuthIdentityUpdateWithWhereUniqueWithoutUserInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => AuthIdentityUpdateManyWithWhereWithoutUserInputSchema), z.lazy(() => AuthIdentityUpdateManyWithWhereWithoutUserInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => AuthIdentityScalarWhereInputSchema), z.lazy(() => AuthIdentityScalarWhereInputSchema).array() ]).optional(),
});

export const UserCreateNestedOneWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutAuthIdentitiesInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedCreateWithoutAuthIdentitiesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutAuthIdentitiesInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
});

export const EnumAuthProviderFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumAuthProviderFieldUpdateOperationsInput> = z.strictObject({
  set: z.lazy(() => AuthProviderSchema).optional(),
});

export const NullableDateTimeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableDateTimeFieldUpdateOperationsInput> = z.strictObject({
  set: z.coerce.date().optional().nullable(),
});

export const UserUpdateOneRequiredWithoutAuthIdentitiesNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutAuthIdentitiesNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedCreateWithoutAuthIdentitiesInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutAuthIdentitiesInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutAuthIdentitiesInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUpdateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedUpdateWithoutAuthIdentitiesInputSchema) ]).optional(),
});

export const UserCreateNestedOneWithoutCollectionsInputSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutCollectionsInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedCreateWithoutCollectionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCollectionsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
});

export const BillHeaderCreateNestedManyWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderCreateNestedManyWithoutCollectionInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema).array(), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillHeaderCreateManyCollectionInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
});

export const BillHeaderUncheckedCreateNestedManyWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUncheckedCreateNestedManyWithoutCollectionInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema).array(), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillHeaderCreateManyCollectionInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
});

export const IntFieldUpdateOperationsInputSchema: z.ZodType<Prisma.IntFieldUpdateOperationsInput> = z.strictObject({
  set: z.number().optional(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional(),
});

export const UserUpdateOneRequiredWithoutCollectionsNestedInputSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutCollectionsNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => UserCreateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedCreateWithoutCollectionsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCollectionsInputSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutCollectionsInputSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => UserUpdateToOneWithWhereWithoutCollectionsInputSchema), z.lazy(() => UserUpdateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCollectionsInputSchema) ]).optional(),
});

export const BillHeaderUpdateManyWithoutCollectionNestedInputSchema: z.ZodType<Prisma.BillHeaderUpdateManyWithoutCollectionNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema).array(), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => BillHeaderUpsertWithWhereUniqueWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpsertWithWhereUniqueWithoutCollectionInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillHeaderCreateManyCollectionInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => BillHeaderUpdateWithWhereUniqueWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpdateWithWhereUniqueWithoutCollectionInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => BillHeaderUpdateManyWithWhereWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpdateManyWithWhereWithoutCollectionInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => BillHeaderScalarWhereInputSchema), z.lazy(() => BillHeaderScalarWhereInputSchema).array() ]).optional(),
});

export const BillHeaderUncheckedUpdateManyWithoutCollectionNestedInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateManyWithoutCollectionNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema).array(), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema), z.lazy(() => BillHeaderCreateOrConnectWithoutCollectionInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => BillHeaderUpsertWithWhereUniqueWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpsertWithWhereUniqueWithoutCollectionInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillHeaderCreateManyCollectionInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => BillHeaderWhereUniqueInputSchema), z.lazy(() => BillHeaderWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => BillHeaderUpdateWithWhereUniqueWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpdateWithWhereUniqueWithoutCollectionInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => BillHeaderUpdateManyWithWhereWithoutCollectionInputSchema), z.lazy(() => BillHeaderUpdateManyWithWhereWithoutCollectionInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => BillHeaderScalarWhereInputSchema), z.lazy(() => BillHeaderScalarWhereInputSchema).array() ]).optional(),
});

export const CollectionCreateNestedOneWithoutBillsInputSchema: z.ZodType<Prisma.CollectionCreateNestedOneWithoutBillsInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutBillsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => CollectionCreateOrConnectWithoutBillsInputSchema).optional(),
  connect: z.lazy(() => CollectionWhereUniqueInputSchema).optional(),
});

export const BillDetailCreateNestedManyWithoutBillInputSchema: z.ZodType<Prisma.BillDetailCreateNestedManyWithoutBillInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailCreateWithoutBillInputSchema).array(), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema), z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillDetailCreateManyBillInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
});

export const BillDetailUncheckedCreateNestedManyWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUncheckedCreateNestedManyWithoutBillInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailCreateWithoutBillInputSchema).array(), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema), z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillDetailCreateManyBillInputEnvelopeSchema).optional(),
  connect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
});

export const FloatFieldUpdateOperationsInputSchema: z.ZodType<Prisma.FloatFieldUpdateOperationsInput> = z.strictObject({
  set: z.number().optional(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional(),
});

export const EnumBillFileTypeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumBillFileTypeFieldUpdateOperationsInput> = z.strictObject({
  set: z.lazy(() => BillFileTypeSchema).optional(),
});

export const EnumBillTargetTypeFieldUpdateOperationsInputSchema: z.ZodType<Prisma.EnumBillTargetTypeFieldUpdateOperationsInput> = z.strictObject({
  set: z.lazy(() => BillTargetTypeSchema).optional(),
});

export const NullableFloatFieldUpdateOperationsInputSchema: z.ZodType<Prisma.NullableFloatFieldUpdateOperationsInput> = z.strictObject({
  set: z.number().optional().nullable(),
  increment: z.number().optional(),
  decrement: z.number().optional(),
  multiply: z.number().optional(),
  divide: z.number().optional(),
});

export const CollectionUpdateOneRequiredWithoutBillsNestedInputSchema: z.ZodType<Prisma.CollectionUpdateOneRequiredWithoutBillsNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => CollectionCreateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutBillsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => CollectionCreateOrConnectWithoutBillsInputSchema).optional(),
  upsert: z.lazy(() => CollectionUpsertWithoutBillsInputSchema).optional(),
  connect: z.lazy(() => CollectionWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => CollectionUpdateToOneWithWhereWithoutBillsInputSchema), z.lazy(() => CollectionUpdateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedUpdateWithoutBillsInputSchema) ]).optional(),
});

export const BillDetailUpdateManyWithoutBillNestedInputSchema: z.ZodType<Prisma.BillDetailUpdateManyWithoutBillNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailCreateWithoutBillInputSchema).array(), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema), z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => BillDetailUpsertWithWhereUniqueWithoutBillInputSchema), z.lazy(() => BillDetailUpsertWithWhereUniqueWithoutBillInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillDetailCreateManyBillInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => BillDetailUpdateWithWhereUniqueWithoutBillInputSchema), z.lazy(() => BillDetailUpdateWithWhereUniqueWithoutBillInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => BillDetailUpdateManyWithWhereWithoutBillInputSchema), z.lazy(() => BillDetailUpdateManyWithWhereWithoutBillInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => BillDetailScalarWhereInputSchema), z.lazy(() => BillDetailScalarWhereInputSchema).array() ]).optional(),
});

export const BillDetailUncheckedUpdateManyWithoutBillNestedInputSchema: z.ZodType<Prisma.BillDetailUncheckedUpdateManyWithoutBillNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailCreateWithoutBillInputSchema).array(), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema).array() ]).optional(),
  connectOrCreate: z.union([ z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema), z.lazy(() => BillDetailCreateOrConnectWithoutBillInputSchema).array() ]).optional(),
  upsert: z.union([ z.lazy(() => BillDetailUpsertWithWhereUniqueWithoutBillInputSchema), z.lazy(() => BillDetailUpsertWithWhereUniqueWithoutBillInputSchema).array() ]).optional(),
  createMany: z.lazy(() => BillDetailCreateManyBillInputEnvelopeSchema).optional(),
  set: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  disconnect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  delete: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  connect: z.union([ z.lazy(() => BillDetailWhereUniqueInputSchema), z.lazy(() => BillDetailWhereUniqueInputSchema).array() ]).optional(),
  update: z.union([ z.lazy(() => BillDetailUpdateWithWhereUniqueWithoutBillInputSchema), z.lazy(() => BillDetailUpdateWithWhereUniqueWithoutBillInputSchema).array() ]).optional(),
  updateMany: z.union([ z.lazy(() => BillDetailUpdateManyWithWhereWithoutBillInputSchema), z.lazy(() => BillDetailUpdateManyWithWhereWithoutBillInputSchema).array() ]).optional(),
  deleteMany: z.union([ z.lazy(() => BillDetailScalarWhereInputSchema), z.lazy(() => BillDetailScalarWhereInputSchema).array() ]).optional(),
});

export const BillHeaderCreateNestedOneWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderCreateNestedOneWithoutDetailsInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutDetailsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => BillHeaderCreateOrConnectWithoutDetailsInputSchema).optional(),
  connect: z.lazy(() => BillHeaderWhereUniqueInputSchema).optional(),
});

export const BillHeaderUpdateOneRequiredWithoutDetailsNestedInputSchema: z.ZodType<Prisma.BillHeaderUpdateOneRequiredWithoutDetailsNestedInput> = z.strictObject({
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutDetailsInputSchema) ]).optional(),
  connectOrCreate: z.lazy(() => BillHeaderCreateOrConnectWithoutDetailsInputSchema).optional(),
  upsert: z.lazy(() => BillHeaderUpsertWithoutDetailsInputSchema).optional(),
  connect: z.lazy(() => BillHeaderWhereUniqueInputSchema).optional(),
  update: z.union([ z.lazy(() => BillHeaderUpdateToOneWithWhereWithoutDetailsInputSchema), z.lazy(() => BillHeaderUpdateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedUpdateWithoutDetailsInputSchema) ]).optional(),
});

export const NestedStringFilterSchema: z.ZodType<Prisma.NestedStringFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringFilterSchema) ]).optional(),
});

export const NestedStringNullableFilterSchema: z.ZodType<Prisma.NestedStringNullableFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableFilterSchema) ]).optional().nullable(),
});

export const NestedDateTimeFilterSchema: z.ZodType<Prisma.NestedDateTimeFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeFilterSchema) ]).optional(),
});

export const NestedStringWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional(),
  in: z.string().array().optional(),
  notIn: z.string().array().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedStringFilterSchema).optional(),
  _max: z.lazy(() => NestedStringFilterSchema).optional(),
});

export const NestedIntFilterSchema: z.ZodType<Prisma.NestedIntFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntFilterSchema) ]).optional(),
});

export const NestedStringNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedStringNullableWithAggregatesFilter> = z.strictObject({
  equals: z.string().optional().nullable(),
  in: z.string().array().optional().nullable(),
  notIn: z.string().array().optional().nullable(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  not: z.union([ z.string(),z.lazy(() => NestedStringNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedStringNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedStringNullableFilterSchema).optional(),
});

export const NestedIntNullableFilterSchema: z.ZodType<Prisma.NestedIntNullableFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntNullableFilterSchema) ]).optional().nullable(),
});

export const NestedDateTimeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedDateTimeWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional(),
  in: z.coerce.date().array().optional(),
  notIn: z.coerce.date().array().optional(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeFilterSchema).optional(),
});

export const NestedEnumAuthProviderFilterSchema: z.ZodType<Prisma.NestedEnumAuthProviderFilter> = z.strictObject({
  equals: z.lazy(() => AuthProviderSchema).optional(),
  in: z.lazy(() => AuthProviderSchema).array().optional(),
  notIn: z.lazy(() => AuthProviderSchema).array().optional(),
  not: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => NestedEnumAuthProviderFilterSchema) ]).optional(),
});

export const NestedDateTimeNullableFilterSchema: z.ZodType<Prisma.NestedDateTimeNullableFilter> = z.strictObject({
  equals: z.coerce.date().optional().nullable(),
  in: z.coerce.date().array().optional().nullable(),
  notIn: z.coerce.date().array().optional().nullable(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeNullableFilterSchema) ]).optional().nullable(),
});

export const NestedEnumAuthProviderWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumAuthProviderWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => AuthProviderSchema).optional(),
  in: z.lazy(() => AuthProviderSchema).array().optional(),
  notIn: z.lazy(() => AuthProviderSchema).array().optional(),
  not: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => NestedEnumAuthProviderWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumAuthProviderFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumAuthProviderFilterSchema).optional(),
});

export const NestedDateTimeNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedDateTimeNullableWithAggregatesFilter> = z.strictObject({
  equals: z.coerce.date().optional().nullable(),
  in: z.coerce.date().array().optional().nullable(),
  notIn: z.coerce.date().array().optional().nullable(),
  lt: z.coerce.date().optional(),
  lte: z.coerce.date().optional(),
  gt: z.coerce.date().optional(),
  gte: z.coerce.date().optional(),
  not: z.union([ z.coerce.date(),z.lazy(() => NestedDateTimeNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedDateTimeNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedDateTimeNullableFilterSchema).optional(),
});

export const NestedIntWithAggregatesFilterSchema: z.ZodType<Prisma.NestedIntWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedIntWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedIntFilterSchema).optional(),
  _max: z.lazy(() => NestedIntFilterSchema).optional(),
});

export const NestedFloatFilterSchema: z.ZodType<Prisma.NestedFloatFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatFilterSchema) ]).optional(),
});

export const NestedEnumBillFileTypeFilterSchema: z.ZodType<Prisma.NestedEnumBillFileTypeFilter> = z.strictObject({
  equals: z.lazy(() => BillFileTypeSchema).optional(),
  in: z.lazy(() => BillFileTypeSchema).array().optional(),
  notIn: z.lazy(() => BillFileTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => NestedEnumBillFileTypeFilterSchema) ]).optional(),
});

export const NestedEnumBillTargetTypeFilterSchema: z.ZodType<Prisma.NestedEnumBillTargetTypeFilter> = z.strictObject({
  equals: z.lazy(() => BillTargetTypeSchema).optional(),
  in: z.lazy(() => BillTargetTypeSchema).array().optional(),
  notIn: z.lazy(() => BillTargetTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => NestedEnumBillTargetTypeFilterSchema) ]).optional(),
});

export const NestedFloatNullableFilterSchema: z.ZodType<Prisma.NestedFloatNullableFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatNullableFilterSchema) ]).optional().nullable(),
});

export const NestedFloatWithAggregatesFilterSchema: z.ZodType<Prisma.NestedFloatWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional(),
  in: z.number().array().optional(),
  notIn: z.number().array().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatFilterSchema).optional(),
});

export const NestedEnumBillFileTypeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumBillFileTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => BillFileTypeSchema).optional(),
  in: z.lazy(() => BillFileTypeSchema).array().optional(),
  notIn: z.lazy(() => BillFileTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => NestedEnumBillFileTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumBillFileTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumBillFileTypeFilterSchema).optional(),
});

export const NestedEnumBillTargetTypeWithAggregatesFilterSchema: z.ZodType<Prisma.NestedEnumBillTargetTypeWithAggregatesFilter> = z.strictObject({
  equals: z.lazy(() => BillTargetTypeSchema).optional(),
  in: z.lazy(() => BillTargetTypeSchema).array().optional(),
  notIn: z.lazy(() => BillTargetTypeSchema).array().optional(),
  not: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => NestedEnumBillTargetTypeWithAggregatesFilterSchema) ]).optional(),
  _count: z.lazy(() => NestedIntFilterSchema).optional(),
  _min: z.lazy(() => NestedEnumBillTargetTypeFilterSchema).optional(),
  _max: z.lazy(() => NestedEnumBillTargetTypeFilterSchema).optional(),
});

export const NestedFloatNullableWithAggregatesFilterSchema: z.ZodType<Prisma.NestedFloatNullableWithAggregatesFilter> = z.strictObject({
  equals: z.number().optional().nullable(),
  in: z.number().array().optional().nullable(),
  notIn: z.number().array().optional().nullable(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  not: z.union([ z.number(),z.lazy(() => NestedFloatNullableWithAggregatesFilterSchema) ]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterSchema).optional(),
  _avg: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _sum: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _min: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
  _max: z.lazy(() => NestedFloatNullableFilterSchema).optional(),
});

export const CollectionCreateWithoutUserInputSchema: z.ZodType<Prisma.CollectionCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  bills: z.lazy(() => BillHeaderCreateNestedManyWithoutCollectionInputSchema).optional(),
});

export const CollectionUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  bills: z.lazy(() => BillHeaderUncheckedCreateNestedManyWithoutCollectionInputSchema).optional(),
});

export const CollectionCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.CollectionCreateOrConnectWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema) ]),
});

export const CollectionCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.CollectionCreateManyUserInputEnvelope> = z.strictObject({
  data: z.union([ z.lazy(() => CollectionCreateManyUserInputSchema), z.lazy(() => CollectionCreateManyUserInputSchema).array() ]),
  skipDuplicates: z.boolean().optional(),
});

export const AuthIdentityCreateWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const AuthIdentityUncheckedCreateWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedCreateWithoutUserInput> = z.strictObject({
  id: z.uuid().optional(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const AuthIdentityCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityCreateOrConnectWithoutUserInput> = z.strictObject({
  where: z.lazy(() => AuthIdentityWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema) ]),
});

export const AuthIdentityCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.AuthIdentityCreateManyUserInputEnvelope> = z.strictObject({
  data: z.union([ z.lazy(() => AuthIdentityCreateManyUserInputSchema), z.lazy(() => AuthIdentityCreateManyUserInputSchema).array() ]),
  skipDuplicates: z.boolean().optional(),
});

export const CollectionUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.CollectionUpsertWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => CollectionUpdateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => CollectionCreateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutUserInputSchema) ]),
});

export const CollectionUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.CollectionUpdateWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateWithoutUserInputSchema), z.lazy(() => CollectionUncheckedUpdateWithoutUserInputSchema) ]),
});

export const CollectionUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.CollectionUpdateManyWithWhereWithoutUserInput> = z.strictObject({
  where: z.lazy(() => CollectionScalarWhereInputSchema),
  data: z.union([ z.lazy(() => CollectionUpdateManyMutationInputSchema), z.lazy(() => CollectionUncheckedUpdateManyWithoutUserInputSchema) ]),
});

export const CollectionScalarWhereInputSchema: z.ZodType<Prisma.CollectionScalarWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => CollectionScalarWhereInputSchema), z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => CollectionScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => CollectionScalarWhereInputSchema), z.lazy(() => CollectionScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  personalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  professionalIdNumber: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  instructions: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  year: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
});

export const AuthIdentityUpsertWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUpsertWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => AuthIdentityWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => AuthIdentityUpdateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedUpdateWithoutUserInputSchema) ]),
  create: z.union([ z.lazy(() => AuthIdentityCreateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedCreateWithoutUserInputSchema) ]),
});

export const AuthIdentityUpdateWithWhereUniqueWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUpdateWithWhereUniqueWithoutUserInput> = z.strictObject({
  where: z.lazy(() => AuthIdentityWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => AuthIdentityUpdateWithoutUserInputSchema), z.lazy(() => AuthIdentityUncheckedUpdateWithoutUserInputSchema) ]),
});

export const AuthIdentityUpdateManyWithWhereWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUpdateManyWithWhereWithoutUserInput> = z.strictObject({
  where: z.lazy(() => AuthIdentityScalarWhereInputSchema),
  data: z.union([ z.lazy(() => AuthIdentityUpdateManyMutationInputSchema), z.lazy(() => AuthIdentityUncheckedUpdateManyWithoutUserInputSchema) ]),
});

export const AuthIdentityScalarWhereInputSchema: z.ZodType<Prisma.AuthIdentityScalarWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => AuthIdentityScalarWhereInputSchema), z.lazy(() => AuthIdentityScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => AuthIdentityScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => AuthIdentityScalarWhereInputSchema), z.lazy(() => AuthIdentityScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  userId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  provider: z.union([ z.lazy(() => EnumAuthProviderFilterSchema), z.lazy(() => AuthProviderSchema) ]).optional(),
  subject: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  linkedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  verifiedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  disabledAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
});

export const UserCreateWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserCreateWithoutAuthIdentitiesInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  collections: z.lazy(() => CollectionCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUncheckedCreateWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutAuthIdentitiesInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  collections: z.lazy(() => CollectionUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserCreateOrConnectWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutAuthIdentitiesInput> = z.strictObject({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedCreateWithoutAuthIdentitiesInputSchema) ]),
});

export const UserUpsertWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserUpsertWithoutAuthIdentitiesInput> = z.strictObject({
  update: z.union([ z.lazy(() => UserUpdateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedUpdateWithoutAuthIdentitiesInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedCreateWithoutAuthIdentitiesInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional(),
});

export const UserUpdateToOneWithWhereWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutAuthIdentitiesInput> = z.strictObject({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutAuthIdentitiesInputSchema), z.lazy(() => UserUncheckedUpdateWithoutAuthIdentitiesInputSchema) ]),
});

export const UserUpdateWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserUpdateWithoutAuthIdentitiesInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  collections: z.lazy(() => CollectionUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserUncheckedUpdateWithoutAuthIdentitiesInputSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutAuthIdentitiesInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  collections: z.lazy(() => CollectionUncheckedUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserCreateWithoutCollectionsInputSchema: z.ZodType<Prisma.UserCreateWithoutCollectionsInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  authIdentities: z.lazy(() => AuthIdentityCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserUncheckedCreateWithoutCollectionsInputSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutCollectionsInput> = z.strictObject({
  id: z.uuid().optional(),
  primaryEmail: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  authIdentities: z.lazy(() => AuthIdentityUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
});

export const UserCreateOrConnectWithoutCollectionsInputSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutCollectionsInput> = z.strictObject({
  where: z.lazy(() => UserWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => UserCreateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedCreateWithoutCollectionsInputSchema) ]),
});

export const BillHeaderCreateWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderCreateWithoutCollectionInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  details: z.lazy(() => BillDetailCreateNestedManyWithoutBillInputSchema).optional(),
});

export const BillHeaderUncheckedCreateWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUncheckedCreateWithoutCollectionInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  details: z.lazy(() => BillDetailUncheckedCreateNestedManyWithoutBillInputSchema).optional(),
});

export const BillHeaderCreateOrConnectWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderCreateOrConnectWithoutCollectionInput> = z.strictObject({
  where: z.lazy(() => BillHeaderWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema) ]),
});

export const BillHeaderCreateManyCollectionInputEnvelopeSchema: z.ZodType<Prisma.BillHeaderCreateManyCollectionInputEnvelope> = z.strictObject({
  data: z.union([ z.lazy(() => BillHeaderCreateManyCollectionInputSchema), z.lazy(() => BillHeaderCreateManyCollectionInputSchema).array() ]),
  skipDuplicates: z.boolean().optional(),
});

export const UserUpsertWithoutCollectionsInputSchema: z.ZodType<Prisma.UserUpsertWithoutCollectionsInput> = z.strictObject({
  update: z.union([ z.lazy(() => UserUpdateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCollectionsInputSchema) ]),
  create: z.union([ z.lazy(() => UserCreateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedCreateWithoutCollectionsInputSchema) ]),
  where: z.lazy(() => UserWhereInputSchema).optional(),
});

export const UserUpdateToOneWithWhereWithoutCollectionsInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutCollectionsInput> = z.strictObject({
  where: z.lazy(() => UserWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => UserUpdateWithoutCollectionsInputSchema), z.lazy(() => UserUncheckedUpdateWithoutCollectionsInputSchema) ]),
});

export const UserUpdateWithoutCollectionsInputSchema: z.ZodType<Prisma.UserUpdateWithoutCollectionsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  authIdentities: z.lazy(() => AuthIdentityUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const UserUncheckedUpdateWithoutCollectionsInputSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutCollectionsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  primaryEmail: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  authIdentities: z.lazy(() => AuthIdentityUncheckedUpdateManyWithoutUserNestedInputSchema).optional(),
});

export const BillHeaderUpsertWithWhereUniqueWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUpsertWithWhereUniqueWithoutCollectionInput> = z.strictObject({
  where: z.lazy(() => BillHeaderWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => BillHeaderUpdateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedUpdateWithoutCollectionInputSchema) ]),
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutCollectionInputSchema) ]),
});

export const BillHeaderUpdateWithWhereUniqueWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUpdateWithWhereUniqueWithoutCollectionInput> = z.strictObject({
  where: z.lazy(() => BillHeaderWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => BillHeaderUpdateWithoutCollectionInputSchema), z.lazy(() => BillHeaderUncheckedUpdateWithoutCollectionInputSchema) ]),
});

export const BillHeaderUpdateManyWithWhereWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUpdateManyWithWhereWithoutCollectionInput> = z.strictObject({
  where: z.lazy(() => BillHeaderScalarWhereInputSchema),
  data: z.union([ z.lazy(() => BillHeaderUpdateManyMutationInputSchema), z.lazy(() => BillHeaderUncheckedUpdateManyWithoutCollectionInputSchema) ]),
});

export const BillHeaderScalarWhereInputSchema: z.ZodType<Prisma.BillHeaderScalarWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillHeaderScalarWhereInputSchema), z.lazy(() => BillHeaderScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillHeaderScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillHeaderScalarWhereInputSchema), z.lazy(() => BillHeaderScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  number: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  name: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  buyerName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idBuyer: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  totalWithoutTaxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  taxes: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  totalAmount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  comercialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  socialName: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  idSeller: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  addressMatriz: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  fileType: z.union([ z.lazy(() => EnumBillFileTypeFilterSchema), z.lazy(() => BillFileTypeSchema) ]).optional(),
  billType: z.union([ z.lazy(() => EnumBillTargetTypeFilterSchema), z.lazy(() => BillTargetTypeSchema) ]).optional(),
  storagePath: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  percentage: z.union([ z.lazy(() => FloatNullableFilterSchema), z.number() ]).optional().nullable(),
  reason: z.union([ z.lazy(() => StringNullableFilterSchema), z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
  collectionId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
});

export const CollectionCreateWithoutBillsInputSchema: z.ZodType<Prisma.CollectionCreateWithoutBillsInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  user: z.lazy(() => UserCreateNestedOneWithoutCollectionsInputSchema),
});

export const CollectionUncheckedCreateWithoutBillsInputSchema: z.ZodType<Prisma.CollectionUncheckedCreateWithoutBillsInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  userId: z.string(),
});

export const CollectionCreateOrConnectWithoutBillsInputSchema: z.ZodType<Prisma.CollectionCreateOrConnectWithoutBillsInput> = z.strictObject({
  where: z.lazy(() => CollectionWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => CollectionCreateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutBillsInputSchema) ]),
});

export const BillDetailCreateWithoutBillInputSchema: z.ZodType<Prisma.BillDetailCreateWithoutBillInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillDetailUncheckedCreateWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUncheckedCreateWithoutBillInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillDetailCreateOrConnectWithoutBillInputSchema: z.ZodType<Prisma.BillDetailCreateOrConnectWithoutBillInput> = z.strictObject({
  where: z.lazy(() => BillDetailWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema) ]),
});

export const BillDetailCreateManyBillInputEnvelopeSchema: z.ZodType<Prisma.BillDetailCreateManyBillInputEnvelope> = z.strictObject({
  data: z.union([ z.lazy(() => BillDetailCreateManyBillInputSchema), z.lazy(() => BillDetailCreateManyBillInputSchema).array() ]),
  skipDuplicates: z.boolean().optional(),
});

export const CollectionUpsertWithoutBillsInputSchema: z.ZodType<Prisma.CollectionUpsertWithoutBillsInput> = z.strictObject({
  update: z.union([ z.lazy(() => CollectionUpdateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedUpdateWithoutBillsInputSchema) ]),
  create: z.union([ z.lazy(() => CollectionCreateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedCreateWithoutBillsInputSchema) ]),
  where: z.lazy(() => CollectionWhereInputSchema).optional(),
});

export const CollectionUpdateToOneWithWhereWithoutBillsInputSchema: z.ZodType<Prisma.CollectionUpdateToOneWithWhereWithoutBillsInput> = z.strictObject({
  where: z.lazy(() => CollectionWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => CollectionUpdateWithoutBillsInputSchema), z.lazy(() => CollectionUncheckedUpdateWithoutBillsInputSchema) ]),
});

export const CollectionUpdateWithoutBillsInputSchema: z.ZodType<Prisma.CollectionUpdateWithoutBillsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutCollectionsNestedInputSchema).optional(),
});

export const CollectionUncheckedUpdateWithoutBillsInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateWithoutBillsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  userId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
});

export const BillDetailUpsertWithWhereUniqueWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUpsertWithWhereUniqueWithoutBillInput> = z.strictObject({
  where: z.lazy(() => BillDetailWhereUniqueInputSchema),
  update: z.union([ z.lazy(() => BillDetailUpdateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedUpdateWithoutBillInputSchema) ]),
  create: z.union([ z.lazy(() => BillDetailCreateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedCreateWithoutBillInputSchema) ]),
});

export const BillDetailUpdateWithWhereUniqueWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUpdateWithWhereUniqueWithoutBillInput> = z.strictObject({
  where: z.lazy(() => BillDetailWhereUniqueInputSchema),
  data: z.union([ z.lazy(() => BillDetailUpdateWithoutBillInputSchema), z.lazy(() => BillDetailUncheckedUpdateWithoutBillInputSchema) ]),
});

export const BillDetailUpdateManyWithWhereWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUpdateManyWithWhereWithoutBillInput> = z.strictObject({
  where: z.lazy(() => BillDetailScalarWhereInputSchema),
  data: z.union([ z.lazy(() => BillDetailUpdateManyMutationInputSchema), z.lazy(() => BillDetailUncheckedUpdateManyWithoutBillInputSchema) ]),
});

export const BillDetailScalarWhereInputSchema: z.ZodType<Prisma.BillDetailScalarWhereInput> = z.strictObject({
  AND: z.union([ z.lazy(() => BillDetailScalarWhereInputSchema), z.lazy(() => BillDetailScalarWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => BillDetailScalarWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => BillDetailScalarWhereInputSchema), z.lazy(() => BillDetailScalarWhereInputSchema).array() ]).optional(),
  id: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  description: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  quantity: z.union([ z.lazy(() => IntFilterSchema), z.number() ]).optional(),
  unitPrice: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  discount: z.union([ z.lazy(() => FloatFilterSchema), z.number() ]).optional(),
  billId: z.union([ z.lazy(() => StringFilterSchema), z.string() ]).optional(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema), z.coerce.date() ]).optional(),
  deletedAt: z.union([ z.lazy(() => DateTimeNullableFilterSchema), z.coerce.date() ]).optional().nullable(),
});

export const BillHeaderCreateWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderCreateWithoutDetailsInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  collection: z.lazy(() => CollectionCreateNestedOneWithoutBillsInputSchema),
});

export const BillHeaderUncheckedCreateWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderUncheckedCreateWithoutDetailsInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  collectionId: z.string(),
});

export const BillHeaderCreateOrConnectWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderCreateOrConnectWithoutDetailsInput> = z.strictObject({
  where: z.lazy(() => BillHeaderWhereUniqueInputSchema),
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutDetailsInputSchema) ]),
});

export const BillHeaderUpsertWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderUpsertWithoutDetailsInput> = z.strictObject({
  update: z.union([ z.lazy(() => BillHeaderUpdateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedUpdateWithoutDetailsInputSchema) ]),
  create: z.union([ z.lazy(() => BillHeaderCreateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedCreateWithoutDetailsInputSchema) ]),
  where: z.lazy(() => BillHeaderWhereInputSchema).optional(),
});

export const BillHeaderUpdateToOneWithWhereWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderUpdateToOneWithWhereWithoutDetailsInput> = z.strictObject({
  where: z.lazy(() => BillHeaderWhereInputSchema).optional(),
  data: z.union([ z.lazy(() => BillHeaderUpdateWithoutDetailsInputSchema), z.lazy(() => BillHeaderUncheckedUpdateWithoutDetailsInputSchema) ]),
});

export const BillHeaderUpdateWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderUpdateWithoutDetailsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  collection: z.lazy(() => CollectionUpdateOneRequiredWithoutBillsNestedInputSchema).optional(),
});

export const BillHeaderUncheckedUpdateWithoutDetailsInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateWithoutDetailsInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  collectionId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
});

export const CollectionCreateManyUserInputSchema: z.ZodType<Prisma.CollectionCreateManyUserInput> = z.strictObject({
  id: z.uuid().optional(),
  name: z.string(),
  description: z.string().optional().nullable(),
  personalIdNumber: z.string(),
  professionalIdNumber: z.string(),
  instructions: z.string().optional().nullable(),
  year: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const AuthIdentityCreateManyUserInputSchema: z.ZodType<Prisma.AuthIdentityCreateManyUserInput> = z.strictObject({
  id: z.uuid().optional(),
  provider: z.lazy(() => AuthProviderSchema),
  subject: z.string(),
  linkedAt: z.coerce.date().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  disabledAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export const CollectionUpdateWithoutUserInputSchema: z.ZodType<Prisma.CollectionUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  bills: z.lazy(() => BillHeaderUpdateManyWithoutCollectionNestedInputSchema).optional(),
});

export const CollectionUncheckedUpdateWithoutUserInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  bills: z.lazy(() => BillHeaderUncheckedUpdateManyWithoutCollectionNestedInputSchema).optional(),
});

export const CollectionUncheckedUpdateManyWithoutUserInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateManyWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  personalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  professionalIdNumber: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  instructions: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  year: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const AuthIdentityUpdateWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const AuthIdentityUncheckedUpdateWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedUpdateWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const AuthIdentityUncheckedUpdateManyWithoutUserInputSchema: z.ZodType<Prisma.AuthIdentityUncheckedUpdateManyWithoutUserInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  provider: z.union([ z.lazy(() => AuthProviderSchema), z.lazy(() => EnumAuthProviderFieldUpdateOperationsInputSchema) ]).optional(),
  subject: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  linkedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  verifiedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  disabledAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
});

export const BillHeaderCreateManyCollectionInputSchema: z.ZodType<Prisma.BillHeaderCreateManyCollectionInput> = z.strictObject({
  id: z.uuid().optional(),
  number: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  buyerName: z.string(),
  idBuyer: z.string(),
  totalWithoutTaxes: z.number(),
  taxes: z.number(),
  totalAmount: z.number(),
  comercialName: z.string(),
  socialName: z.string(),
  idSeller: z.string(),
  addressMatriz: z.string(),
  fileType: z.lazy(() => BillFileTypeSchema).optional(),
  billType: z.lazy(() => BillTargetTypeSchema).optional(),
  storagePath: z.string(),
  percentage: z.number().optional().nullable(),
  reason: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillHeaderUpdateWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUpdateWithoutCollectionInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  details: z.lazy(() => BillDetailUpdateManyWithoutBillNestedInputSchema).optional(),
});

export const BillHeaderUncheckedUpdateWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateWithoutCollectionInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  details: z.lazy(() => BillDetailUncheckedUpdateManyWithoutBillNestedInputSchema).optional(),
});

export const BillHeaderUncheckedUpdateManyWithoutCollectionInputSchema: z.ZodType<Prisma.BillHeaderUncheckedUpdateManyWithoutCollectionInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  number: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  buyerName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idBuyer: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  totalWithoutTaxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  taxes: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  totalAmount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  comercialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  socialName: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  idSeller: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  addressMatriz: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  fileType: z.union([ z.lazy(() => BillFileTypeSchema), z.lazy(() => EnumBillFileTypeFieldUpdateOperationsInputSchema) ]).optional(),
  billType: z.union([ z.lazy(() => BillTargetTypeSchema), z.lazy(() => EnumBillTargetTypeFieldUpdateOperationsInputSchema) ]).optional(),
  storagePath: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  percentage: z.union([ z.number(),z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  reason: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillDetailCreateManyBillInputSchema: z.ZodType<Prisma.BillDetailCreateManyBillInput> = z.strictObject({
  id: z.uuid().optional(),
  description: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
});

export const BillDetailUpdateWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUpdateWithoutBillInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillDetailUncheckedUpdateWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUncheckedUpdateWithoutBillInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

export const BillDetailUncheckedUpdateManyWithoutBillInputSchema: z.ZodType<Prisma.BillDetailUncheckedUpdateManyWithoutBillInput> = z.strictObject({
  id: z.union([ z.uuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  quantity: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  unitPrice: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  discount: z.union([ z.number(),z.lazy(() => FloatFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  updatedAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  deletedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
});

/////////////////////////////////////////
// ARGS
/////////////////////////////////////////

export const UserFindFirstArgsSchema: z.ZodType<Prisma.UserFindFirstArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserFindFirstOrThrowArgsSchema: z.ZodType<Prisma.UserFindFirstOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserFindManyArgsSchema: z.ZodType<Prisma.UserFindManyArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ UserScalarFieldEnumSchema, UserScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const UserAggregateArgsSchema: z.ZodType<Prisma.UserAggregateArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithRelationInputSchema.array(), UserOrderByWithRelationInputSchema ]).optional(),
  cursor: UserWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const UserGroupByArgsSchema: z.ZodType<Prisma.UserGroupByArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  orderBy: z.union([ UserOrderByWithAggregationInputSchema.array(), UserOrderByWithAggregationInputSchema ]).optional(),
  by: UserScalarFieldEnumSchema.array(), 
  having: UserScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const UserFindUniqueArgsSchema: z.ZodType<Prisma.UserFindUniqueArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.UserFindUniqueOrThrowArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const AuthIdentityFindFirstArgsSchema: z.ZodType<Prisma.AuthIdentityFindFirstArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereInputSchema.optional(), 
  orderBy: z.union([ AuthIdentityOrderByWithRelationInputSchema.array(), AuthIdentityOrderByWithRelationInputSchema ]).optional(),
  cursor: AuthIdentityWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ AuthIdentityScalarFieldEnumSchema, AuthIdentityScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const AuthIdentityFindFirstOrThrowArgsSchema: z.ZodType<Prisma.AuthIdentityFindFirstOrThrowArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereInputSchema.optional(), 
  orderBy: z.union([ AuthIdentityOrderByWithRelationInputSchema.array(), AuthIdentityOrderByWithRelationInputSchema ]).optional(),
  cursor: AuthIdentityWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ AuthIdentityScalarFieldEnumSchema, AuthIdentityScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const AuthIdentityFindManyArgsSchema: z.ZodType<Prisma.AuthIdentityFindManyArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereInputSchema.optional(), 
  orderBy: z.union([ AuthIdentityOrderByWithRelationInputSchema.array(), AuthIdentityOrderByWithRelationInputSchema ]).optional(),
  cursor: AuthIdentityWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ AuthIdentityScalarFieldEnumSchema, AuthIdentityScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const AuthIdentityAggregateArgsSchema: z.ZodType<Prisma.AuthIdentityAggregateArgs> = z.object({
  where: AuthIdentityWhereInputSchema.optional(), 
  orderBy: z.union([ AuthIdentityOrderByWithRelationInputSchema.array(), AuthIdentityOrderByWithRelationInputSchema ]).optional(),
  cursor: AuthIdentityWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const AuthIdentityGroupByArgsSchema: z.ZodType<Prisma.AuthIdentityGroupByArgs> = z.object({
  where: AuthIdentityWhereInputSchema.optional(), 
  orderBy: z.union([ AuthIdentityOrderByWithAggregationInputSchema.array(), AuthIdentityOrderByWithAggregationInputSchema ]).optional(),
  by: AuthIdentityScalarFieldEnumSchema.array(), 
  having: AuthIdentityScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const AuthIdentityFindUniqueArgsSchema: z.ZodType<Prisma.AuthIdentityFindUniqueArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereUniqueInputSchema, 
}).strict();

export const AuthIdentityFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.AuthIdentityFindUniqueOrThrowArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereUniqueInputSchema, 
}).strict();

export const CollectionFindFirstArgsSchema: z.ZodType<Prisma.CollectionFindFirstArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereInputSchema.optional(), 
  orderBy: z.union([ CollectionOrderByWithRelationInputSchema.array(), CollectionOrderByWithRelationInputSchema ]).optional(),
  cursor: CollectionWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CollectionScalarFieldEnumSchema, CollectionScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CollectionFindFirstOrThrowArgsSchema: z.ZodType<Prisma.CollectionFindFirstOrThrowArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereInputSchema.optional(), 
  orderBy: z.union([ CollectionOrderByWithRelationInputSchema.array(), CollectionOrderByWithRelationInputSchema ]).optional(),
  cursor: CollectionWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CollectionScalarFieldEnumSchema, CollectionScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CollectionFindManyArgsSchema: z.ZodType<Prisma.CollectionFindManyArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereInputSchema.optional(), 
  orderBy: z.union([ CollectionOrderByWithRelationInputSchema.array(), CollectionOrderByWithRelationInputSchema ]).optional(),
  cursor: CollectionWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ CollectionScalarFieldEnumSchema, CollectionScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const CollectionAggregateArgsSchema: z.ZodType<Prisma.CollectionAggregateArgs> = z.object({
  where: CollectionWhereInputSchema.optional(), 
  orderBy: z.union([ CollectionOrderByWithRelationInputSchema.array(), CollectionOrderByWithRelationInputSchema ]).optional(),
  cursor: CollectionWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const CollectionGroupByArgsSchema: z.ZodType<Prisma.CollectionGroupByArgs> = z.object({
  where: CollectionWhereInputSchema.optional(), 
  orderBy: z.union([ CollectionOrderByWithAggregationInputSchema.array(), CollectionOrderByWithAggregationInputSchema ]).optional(),
  by: CollectionScalarFieldEnumSchema.array(), 
  having: CollectionScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const CollectionFindUniqueArgsSchema: z.ZodType<Prisma.CollectionFindUniqueArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereUniqueInputSchema, 
}).strict();

export const CollectionFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.CollectionFindUniqueOrThrowArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereUniqueInputSchema, 
}).strict();

export const BillHeaderFindFirstArgsSchema: z.ZodType<Prisma.BillHeaderFindFirstArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereInputSchema.optional(), 
  orderBy: z.union([ BillHeaderOrderByWithRelationInputSchema.array(), BillHeaderOrderByWithRelationInputSchema ]).optional(),
  cursor: BillHeaderWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillHeaderScalarFieldEnumSchema, BillHeaderScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillHeaderFindFirstOrThrowArgsSchema: z.ZodType<Prisma.BillHeaderFindFirstOrThrowArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereInputSchema.optional(), 
  orderBy: z.union([ BillHeaderOrderByWithRelationInputSchema.array(), BillHeaderOrderByWithRelationInputSchema ]).optional(),
  cursor: BillHeaderWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillHeaderScalarFieldEnumSchema, BillHeaderScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillHeaderFindManyArgsSchema: z.ZodType<Prisma.BillHeaderFindManyArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereInputSchema.optional(), 
  orderBy: z.union([ BillHeaderOrderByWithRelationInputSchema.array(), BillHeaderOrderByWithRelationInputSchema ]).optional(),
  cursor: BillHeaderWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillHeaderScalarFieldEnumSchema, BillHeaderScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillHeaderAggregateArgsSchema: z.ZodType<Prisma.BillHeaderAggregateArgs> = z.object({
  where: BillHeaderWhereInputSchema.optional(), 
  orderBy: z.union([ BillHeaderOrderByWithRelationInputSchema.array(), BillHeaderOrderByWithRelationInputSchema ]).optional(),
  cursor: BillHeaderWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const BillHeaderGroupByArgsSchema: z.ZodType<Prisma.BillHeaderGroupByArgs> = z.object({
  where: BillHeaderWhereInputSchema.optional(), 
  orderBy: z.union([ BillHeaderOrderByWithAggregationInputSchema.array(), BillHeaderOrderByWithAggregationInputSchema ]).optional(),
  by: BillHeaderScalarFieldEnumSchema.array(), 
  having: BillHeaderScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const BillHeaderFindUniqueArgsSchema: z.ZodType<Prisma.BillHeaderFindUniqueArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereUniqueInputSchema, 
}).strict();

export const BillHeaderFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.BillHeaderFindUniqueOrThrowArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereUniqueInputSchema, 
}).strict();

export const BillDetailFindFirstArgsSchema: z.ZodType<Prisma.BillDetailFindFirstArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereInputSchema.optional(), 
  orderBy: z.union([ BillDetailOrderByWithRelationInputSchema.array(), BillDetailOrderByWithRelationInputSchema ]).optional(),
  cursor: BillDetailWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillDetailScalarFieldEnumSchema, BillDetailScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillDetailFindFirstOrThrowArgsSchema: z.ZodType<Prisma.BillDetailFindFirstOrThrowArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereInputSchema.optional(), 
  orderBy: z.union([ BillDetailOrderByWithRelationInputSchema.array(), BillDetailOrderByWithRelationInputSchema ]).optional(),
  cursor: BillDetailWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillDetailScalarFieldEnumSchema, BillDetailScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillDetailFindManyArgsSchema: z.ZodType<Prisma.BillDetailFindManyArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereInputSchema.optional(), 
  orderBy: z.union([ BillDetailOrderByWithRelationInputSchema.array(), BillDetailOrderByWithRelationInputSchema ]).optional(),
  cursor: BillDetailWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.union([ BillDetailScalarFieldEnumSchema, BillDetailScalarFieldEnumSchema.array() ]).optional(),
}).strict();

export const BillDetailAggregateArgsSchema: z.ZodType<Prisma.BillDetailAggregateArgs> = z.object({
  where: BillDetailWhereInputSchema.optional(), 
  orderBy: z.union([ BillDetailOrderByWithRelationInputSchema.array(), BillDetailOrderByWithRelationInputSchema ]).optional(),
  cursor: BillDetailWhereUniqueInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const BillDetailGroupByArgsSchema: z.ZodType<Prisma.BillDetailGroupByArgs> = z.object({
  where: BillDetailWhereInputSchema.optional(), 
  orderBy: z.union([ BillDetailOrderByWithAggregationInputSchema.array(), BillDetailOrderByWithAggregationInputSchema ]).optional(),
  by: BillDetailScalarFieldEnumSchema.array(), 
  having: BillDetailScalarWhereWithAggregatesInputSchema.optional(), 
  take: z.number().optional(),
  skip: z.number().optional(),
}).strict();

export const BillDetailFindUniqueArgsSchema: z.ZodType<Prisma.BillDetailFindUniqueArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereUniqueInputSchema, 
}).strict();

export const BillDetailFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.BillDetailFindUniqueOrThrowArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereUniqueInputSchema, 
}).strict();

export const UserCreateArgsSchema: z.ZodType<Prisma.UserCreateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserCreateInputSchema, UserUncheckedCreateInputSchema ]),
}).strict();

export const UserUpsertArgsSchema: z.ZodType<Prisma.UserUpsertArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
  create: z.union([ UserCreateInputSchema, UserUncheckedCreateInputSchema ]),
  update: z.union([ UserUpdateInputSchema, UserUncheckedUpdateInputSchema ]),
}).strict();

export const UserCreateManyArgsSchema: z.ZodType<Prisma.UserCreateManyArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema, UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const UserCreateManyAndReturnArgsSchema: z.ZodType<Prisma.UserCreateManyAndReturnArgs> = z.object({
  data: z.union([ UserCreateManyInputSchema, UserCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const UserDeleteArgsSchema: z.ZodType<Prisma.UserDeleteArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserUpdateArgsSchema: z.ZodType<Prisma.UserUpdateArgs> = z.object({
  select: UserSelectSchema.optional(),
  include: UserIncludeSchema.optional(),
  data: z.union([ UserUpdateInputSchema, UserUncheckedUpdateInputSchema ]),
  where: UserWhereUniqueInputSchema, 
}).strict();

export const UserUpdateManyArgsSchema: z.ZodType<Prisma.UserUpdateManyArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema, UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const UserUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.UserUpdateManyAndReturnArgs> = z.object({
  data: z.union([ UserUpdateManyMutationInputSchema, UserUncheckedUpdateManyInputSchema ]),
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const UserDeleteManyArgsSchema: z.ZodType<Prisma.UserDeleteManyArgs> = z.object({
  where: UserWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const AuthIdentityCreateArgsSchema: z.ZodType<Prisma.AuthIdentityCreateArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  data: z.union([ AuthIdentityCreateInputSchema, AuthIdentityUncheckedCreateInputSchema ]),
}).strict();

export const AuthIdentityUpsertArgsSchema: z.ZodType<Prisma.AuthIdentityUpsertArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereUniqueInputSchema, 
  create: z.union([ AuthIdentityCreateInputSchema, AuthIdentityUncheckedCreateInputSchema ]),
  update: z.union([ AuthIdentityUpdateInputSchema, AuthIdentityUncheckedUpdateInputSchema ]),
}).strict();

export const AuthIdentityCreateManyArgsSchema: z.ZodType<Prisma.AuthIdentityCreateManyArgs> = z.object({
  data: z.union([ AuthIdentityCreateManyInputSchema, AuthIdentityCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const AuthIdentityCreateManyAndReturnArgsSchema: z.ZodType<Prisma.AuthIdentityCreateManyAndReturnArgs> = z.object({
  data: z.union([ AuthIdentityCreateManyInputSchema, AuthIdentityCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const AuthIdentityDeleteArgsSchema: z.ZodType<Prisma.AuthIdentityDeleteArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  where: AuthIdentityWhereUniqueInputSchema, 
}).strict();

export const AuthIdentityUpdateArgsSchema: z.ZodType<Prisma.AuthIdentityUpdateArgs> = z.object({
  select: AuthIdentitySelectSchema.optional(),
  include: AuthIdentityIncludeSchema.optional(),
  data: z.union([ AuthIdentityUpdateInputSchema, AuthIdentityUncheckedUpdateInputSchema ]),
  where: AuthIdentityWhereUniqueInputSchema, 
}).strict();

export const AuthIdentityUpdateManyArgsSchema: z.ZodType<Prisma.AuthIdentityUpdateManyArgs> = z.object({
  data: z.union([ AuthIdentityUpdateManyMutationInputSchema, AuthIdentityUncheckedUpdateManyInputSchema ]),
  where: AuthIdentityWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const AuthIdentityUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.AuthIdentityUpdateManyAndReturnArgs> = z.object({
  data: z.union([ AuthIdentityUpdateManyMutationInputSchema, AuthIdentityUncheckedUpdateManyInputSchema ]),
  where: AuthIdentityWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const AuthIdentityDeleteManyArgsSchema: z.ZodType<Prisma.AuthIdentityDeleteManyArgs> = z.object({
  where: AuthIdentityWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CollectionCreateArgsSchema: z.ZodType<Prisma.CollectionCreateArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  data: z.union([ CollectionCreateInputSchema, CollectionUncheckedCreateInputSchema ]),
}).strict();

export const CollectionUpsertArgsSchema: z.ZodType<Prisma.CollectionUpsertArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereUniqueInputSchema, 
  create: z.union([ CollectionCreateInputSchema, CollectionUncheckedCreateInputSchema ]),
  update: z.union([ CollectionUpdateInputSchema, CollectionUncheckedUpdateInputSchema ]),
}).strict();

export const CollectionCreateManyArgsSchema: z.ZodType<Prisma.CollectionCreateManyArgs> = z.object({
  data: z.union([ CollectionCreateManyInputSchema, CollectionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const CollectionCreateManyAndReturnArgsSchema: z.ZodType<Prisma.CollectionCreateManyAndReturnArgs> = z.object({
  data: z.union([ CollectionCreateManyInputSchema, CollectionCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const CollectionDeleteArgsSchema: z.ZodType<Prisma.CollectionDeleteArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  where: CollectionWhereUniqueInputSchema, 
}).strict();

export const CollectionUpdateArgsSchema: z.ZodType<Prisma.CollectionUpdateArgs> = z.object({
  select: CollectionSelectSchema.optional(),
  include: CollectionIncludeSchema.optional(),
  data: z.union([ CollectionUpdateInputSchema, CollectionUncheckedUpdateInputSchema ]),
  where: CollectionWhereUniqueInputSchema, 
}).strict();

export const CollectionUpdateManyArgsSchema: z.ZodType<Prisma.CollectionUpdateManyArgs> = z.object({
  data: z.union([ CollectionUpdateManyMutationInputSchema, CollectionUncheckedUpdateManyInputSchema ]),
  where: CollectionWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CollectionUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.CollectionUpdateManyAndReturnArgs> = z.object({
  data: z.union([ CollectionUpdateManyMutationInputSchema, CollectionUncheckedUpdateManyInputSchema ]),
  where: CollectionWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const CollectionDeleteManyArgsSchema: z.ZodType<Prisma.CollectionDeleteManyArgs> = z.object({
  where: CollectionWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillHeaderCreateArgsSchema: z.ZodType<Prisma.BillHeaderCreateArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  data: z.union([ BillHeaderCreateInputSchema, BillHeaderUncheckedCreateInputSchema ]),
}).strict();

export const BillHeaderUpsertArgsSchema: z.ZodType<Prisma.BillHeaderUpsertArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereUniqueInputSchema, 
  create: z.union([ BillHeaderCreateInputSchema, BillHeaderUncheckedCreateInputSchema ]),
  update: z.union([ BillHeaderUpdateInputSchema, BillHeaderUncheckedUpdateInputSchema ]),
}).strict();

export const BillHeaderCreateManyArgsSchema: z.ZodType<Prisma.BillHeaderCreateManyArgs> = z.object({
  data: z.union([ BillHeaderCreateManyInputSchema, BillHeaderCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const BillHeaderCreateManyAndReturnArgsSchema: z.ZodType<Prisma.BillHeaderCreateManyAndReturnArgs> = z.object({
  data: z.union([ BillHeaderCreateManyInputSchema, BillHeaderCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const BillHeaderDeleteArgsSchema: z.ZodType<Prisma.BillHeaderDeleteArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  where: BillHeaderWhereUniqueInputSchema, 
}).strict();

export const BillHeaderUpdateArgsSchema: z.ZodType<Prisma.BillHeaderUpdateArgs> = z.object({
  select: BillHeaderSelectSchema.optional(),
  include: BillHeaderIncludeSchema.optional(),
  data: z.union([ BillHeaderUpdateInputSchema, BillHeaderUncheckedUpdateInputSchema ]),
  where: BillHeaderWhereUniqueInputSchema, 
}).strict();

export const BillHeaderUpdateManyArgsSchema: z.ZodType<Prisma.BillHeaderUpdateManyArgs> = z.object({
  data: z.union([ BillHeaderUpdateManyMutationInputSchema, BillHeaderUncheckedUpdateManyInputSchema ]),
  where: BillHeaderWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillHeaderUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.BillHeaderUpdateManyAndReturnArgs> = z.object({
  data: z.union([ BillHeaderUpdateManyMutationInputSchema, BillHeaderUncheckedUpdateManyInputSchema ]),
  where: BillHeaderWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillHeaderDeleteManyArgsSchema: z.ZodType<Prisma.BillHeaderDeleteManyArgs> = z.object({
  where: BillHeaderWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillDetailCreateArgsSchema: z.ZodType<Prisma.BillDetailCreateArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  data: z.union([ BillDetailCreateInputSchema, BillDetailUncheckedCreateInputSchema ]),
}).strict();

export const BillDetailUpsertArgsSchema: z.ZodType<Prisma.BillDetailUpsertArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereUniqueInputSchema, 
  create: z.union([ BillDetailCreateInputSchema, BillDetailUncheckedCreateInputSchema ]),
  update: z.union([ BillDetailUpdateInputSchema, BillDetailUncheckedUpdateInputSchema ]),
}).strict();

export const BillDetailCreateManyArgsSchema: z.ZodType<Prisma.BillDetailCreateManyArgs> = z.object({
  data: z.union([ BillDetailCreateManyInputSchema, BillDetailCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const BillDetailCreateManyAndReturnArgsSchema: z.ZodType<Prisma.BillDetailCreateManyAndReturnArgs> = z.object({
  data: z.union([ BillDetailCreateManyInputSchema, BillDetailCreateManyInputSchema.array() ]),
  skipDuplicates: z.boolean().optional(),
}).strict();

export const BillDetailDeleteArgsSchema: z.ZodType<Prisma.BillDetailDeleteArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  where: BillDetailWhereUniqueInputSchema, 
}).strict();

export const BillDetailUpdateArgsSchema: z.ZodType<Prisma.BillDetailUpdateArgs> = z.object({
  select: BillDetailSelectSchema.optional(),
  include: BillDetailIncludeSchema.optional(),
  data: z.union([ BillDetailUpdateInputSchema, BillDetailUncheckedUpdateInputSchema ]),
  where: BillDetailWhereUniqueInputSchema, 
}).strict();

export const BillDetailUpdateManyArgsSchema: z.ZodType<Prisma.BillDetailUpdateManyArgs> = z.object({
  data: z.union([ BillDetailUpdateManyMutationInputSchema, BillDetailUncheckedUpdateManyInputSchema ]),
  where: BillDetailWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillDetailUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.BillDetailUpdateManyAndReturnArgs> = z.object({
  data: z.union([ BillDetailUpdateManyMutationInputSchema, BillDetailUncheckedUpdateManyInputSchema ]),
  where: BillDetailWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();

export const BillDetailDeleteManyArgsSchema: z.ZodType<Prisma.BillDetailDeleteManyArgs> = z.object({
  where: BillDetailWhereInputSchema.optional(), 
  limit: z.number().optional(),
}).strict();