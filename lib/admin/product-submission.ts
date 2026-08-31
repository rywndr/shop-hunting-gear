import { z } from "zod"

import {
  MAX_PRODUCT_IMAGES,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  productFormSchema,
  type ProductFormValues,
} from "./product-form"

const imageReferenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("new"),
    field: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal("existing"),
    id: z.string().min(1),
    name: z.string().min(1),
  }),
])

const submittedOptionSchema = z.object({
  value: z.string(),
  image: imageReferenceSchema.nullable(),
  price: z.number().nullable(),
  weight: z.number().nullable(),
})

const submittedVariantSchema = z.object({
  label: z.string(),
  options: z.array(submittedOptionSchema).max(MAX_VARIANT_OPTIONS),
})

export const productSubmissionSchema = z.object({
  images: z.array(imageReferenceSchema).max(MAX_PRODUCT_IMAGES),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  stock: z.number(),
  weight: z.number(),
  variants: z.array(submittedVariantSchema).max(MAX_VARIANTS),
})

export type ProductSubmission = z.infer<typeof productSubmissionSchema>

export const PRODUCT_PAYLOAD_FIELD = "product"

export function productSubmissionFormData(values: ProductFormValues) {
  const formData = new FormData()
  let fileNumber = 0

  function addFile(file: File, name: string) {
    const field = `file-${fileNumber}`
    fileNumber += 1
    formData.append(field, file)
    return { kind: "new" as const, field, name }
  }

  function imageReference(image: ProductFormValues["images"][number]) {
    return image.kind === "new"
      ? addFile(image.file, image.name)
      : { kind: "existing" as const, id: image.id, name: image.name }
  }

  const submission = {
    ...values,
    images: values.images.map(imageReference),
    variants: values.variants.map((variant) => ({
      ...variant,
      options: variant.options.map((option) => ({
        ...option,
        image: option.image ? imageReference(option.image) : null,
      })),
    })),
  } satisfies ProductSubmission

  formData.set(PRODUCT_PAYLOAD_FIELD, JSON.stringify(submission))
  return formData
}

export function resolveProductSubmission({
  submission,
  formData,
}: {
  submission: ProductSubmission
  formData: FormData
}) {
  let missingFile = false

  function imageDraft(reference: z.infer<typeof imageReferenceSchema>) {
    if (reference.kind === "existing") {
      missingFile = true
      return null
    }
    const file = formData.get(reference.field)

    if (!(file instanceof File)) {
      missingFile = true
      return null
    }

    return {
      kind: "new" as const,
      file,
      name: reference.name,
      previewUrl: "server-upload",
    }
  }

  const images = submission.images.map(imageDraft)
  const values = {
    ...submission,
    images,
    variants: submission.variants.map((variant) => ({
      ...variant,
      options: variant.options.map((option) => ({
        ...option,
        image: option.image ? imageDraft(option.image) : null,
      })),
    })),
  }

  return missingFile ? null : productFormSchema.safeParse(values)
}
