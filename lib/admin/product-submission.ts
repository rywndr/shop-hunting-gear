import { z } from "zod"

import {
  MAX_PRODUCT_IMAGES,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  productFormSchema,
  type ProductFormValues,
} from "./product-form"

const fileReferenceSchema = z.object({
  field: z.string().min(1),
  name: z.string().min(1),
})

const submittedOptionSchema = z.object({
  value: z.string(),
  image: fileReferenceSchema.nullable(),
  price: z.number().nullable(),
  weight: z.number().nullable(),
})

const submittedVariantSchema = z.object({
  label: z.string(),
  options: z.array(submittedOptionSchema).max(MAX_VARIANT_OPTIONS),
})

export const productSubmissionSchema = z.object({
  images: z.array(fileReferenceSchema).max(MAX_PRODUCT_IMAGES),
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
    return { field, name }
  }

  const submission = {
    ...values,
    images: values.images.map(({ file, name }) => addFile(file, name)),
    variants: values.variants.map((variant) => ({
      ...variant,
      options: variant.options.map((option) => ({
        ...option,
        image: option.image
          ? addFile(option.image.file, option.image.name)
          : null,
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

  function imageDraft(reference: z.infer<typeof fileReferenceSchema>) {
    const file = formData.get(reference.field)

    if (!(file instanceof File)) {
      missingFile = true
      return null
    }

    return { file, name: reference.name, previewUrl: "server-upload" }
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
