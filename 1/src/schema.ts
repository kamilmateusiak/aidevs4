import { z } from "zod";

export const PersonSchema = z.object({
  name: z.string(),
  surname: z.string(),
  gender: z.enum(["M", "F"]),
  birthDate: z.string().date(),
  birthPlace: z.string(),
  birthCountry: z.string(),
  job: z.string(),
});

export type Person = z.infer<typeof PersonSchema>;

export const TAG_VALUES = ["IT", "transport", "edukacja", "medycyna", "praca z ludźmi", "praca z pojazdami", "praca fizyczna"] as const;

export const TagSchema = z.enum(TAG_VALUES);

export const TaggedPersonSchema = z.object({
  name: z.string(),
  surname: z.string(),
  gender: z.enum(["M", "F"]),
  born: z.number(),
  city: z.string(),
  tags: z.array(TagSchema),
});

export type TaggedPerson = z.infer<typeof TaggedPersonSchema>;

export const TaggedPersonsSchema = z.array(TaggedPersonSchema);
