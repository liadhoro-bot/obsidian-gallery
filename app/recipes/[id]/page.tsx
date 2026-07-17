import { Suspense } from 'react'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { updatePaintOwnership } from '../../../utils/paint-ownership/update-paint-ownership'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import RecipeDetailClient from './recipe-detail-client'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  getCachedCatalogPaintOptions,
  getCachedPublicRecipe,
  getCachedPublicRecipeAssets,
} from '../../../lib/public-cache'
import { createPerfTimer } from '../../../utils/perf/server'
import ContentActionRow from '../../components/social/content-action-row'
import {
  reportRecipe,
  toggleRecipeLike,
  toggleRecipeSave,
} from '../../components/social/actions'
import { getRecipeSocialState } from '../../components/social/data'
import {
  getSafeImageExtension,
  type GalleryUploadResult,
  validateGalleryImageFile,
} from '../../../utils/images/gallery-upload'
import NominateForContestCard from '../../../components/contests/nominate-for-contest-card'
import { getEligibleContestsForSource } from '../../../lib/contests/queries'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { TopBarSkeleton } from '../../dashboard/dashboard-skeletons'
import { getDashboardProfile } from '../../dashboard/dashboard-data'

function parsePaintSelection(rawValue: string) {
  if (!rawValue) {
    return {
      paint_source: null,
      paint_catalog_id: null,
      custom_paint_id: null,
    }
  }

  if (rawValue.includes(':')) {
    const [source, id] = rawValue.split(':')

    if (source === 'catalog') {
      return {
        paint_source: 'catalog',
        paint_catalog_id: id,
        custom_paint_id: null,
      }
    }

    if (source === 'custom') {
      return {
        paint_source: 'custom',
        paint_catalog_id: null,
        custom_paint_id: id,
      }
    }
  }

  return {
    paint_source: 'catalog',
    paint_catalog_id: rawValue,
    custom_paint_id: null,
  }
}

function revalidateRecipeCaches(recipeId: string) {
  revalidatePath(`/recipes/${recipeId}`)
  revalidateTag(`recipe:${recipeId}`, 'max')
  revalidateTag('public-recipes', 'max')
}

async function updateRecipeHeader(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim() || null

  if (!recipeId || !name) return

  const { error } = await supabase
    .from('recipes')
    .update({
      name,
      description,
    })
    .eq('id', recipeId)

  if (error) {
    console.error('Error updating recipe header:', error)
    return
  }

  revalidateRecipeCaches(recipeId)
}

async function updateRecipeInventory(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const inventoryRequired =
    formData.get('inventoryRequired')?.toString().trim() || null

  if (!recipeId) return

  const { error } = await supabase
    .from('recipes')
    .update({
      inventory_required: inventoryRequired,
    })
    .eq('id', recipeId)

  if (error) {
    console.error('Error updating recipe inventory:', error)
    return
  }

  revalidateRecipeCaches(recipeId)
}

async function updateRecipePaintOwnership(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const recipeId = formData.get('recipeId')?.toString()
  const paintCatalogId = formData.get('paintCatalogId')?.toString()
  const action = formData.get('action')?.toString()
  const currentValue = formData.get('currentValue')?.toString() === 'true'

  if (!recipeId || !paintCatalogId) return
  if (action !== 'owned' && action !== 'wishlist') return

  await updatePaintOwnership({
    userId: user.id,
    paintCatalogId,
    action,
    currentValue,
  })

  revalidateRecipeCaches(recipeId)
}

async function updateRecipeTips(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const expertTips = formData.get('expertTips')?.toString().trim() || null

  if (!recipeId) return

  const { error } = await supabase
    .from('recipes')
    .update({
      expert_tips: expertTips,
    })
    .eq('id', recipeId)

  if (error) {
    console.error('Error updating recipe tips:', error)
    return
  }

  revalidateRecipeCaches(recipeId)
}

async function addRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()
const {
  data: { user },
} = await supabase.auth.getUser()

if (!user) return
  const recipeId = formData.get('recipeId')?.toString()
  const title = formData.get('title')?.toString().trim()
const instructions = formData.get('instructions')?.toString().trim() || null

  const paintId1 = formData.get('paintId1')?.toString() || ''
  const ratio1 = formData.get('ratio1')?.toString().trim() || null

  const paintId2 = formData.get('paintId2')?.toString() || ''
  const ratio2 = formData.get('ratio2')?.toString().trim() || null

  const paintId3 = formData.get('paintId3')?.toString() || ''
  const ratio3 = formData.get('ratio3')?.toString().trim() || null

if (!recipeId || !title) return
  const { data: existingSteps, error: fetchError } = await supabase
    .from('recipe_steps')
    .select('step_number')
    .eq('recipe_id', recipeId)
    .order('step_number', { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error('Error fetching recipe steps:', fetchError)
    return
  }

  const nextStepNumber =
    existingSteps && existingSteps.length > 0
      ? existingSteps[0].step_number + 1
      : 1

  const { data: insertedStep, error: stepInsertError } = await supabase
  .from('recipe_steps')
  .insert([
    {
      recipe_id: recipeId,
      user_id: user.id,
      step_number: nextStepNumber,
      title,
      instructions,
    },
  ])
  .select()
  .single()

  if (stepInsertError || !insertedStep) {
    console.error('Error adding recipe step:', stepInsertError)
    return
  }

  const paint1 = parsePaintSelection(paintId1)
  const paint2 = parsePaintSelection(paintId2)
  const paint3 = parsePaintSelection(paintId3)

  const stepPaintsToInsert = []

  if (paintId1) {
  stepPaintsToInsert.push({
    recipe_step_id: insertedStep.id,
    user_id: user.id,
    paint_source: paint1.paint_source,
    paint_catalog_id: paint1.paint_catalog_id,
    custom_paint_id: paint1.custom_paint_id,
    paint_order: 1,
    ratio_text: ratio1,
  })
}

  if (paintId2) {
  stepPaintsToInsert.push({
    recipe_step_id: insertedStep.id,
    user_id: user.id,
    paint_source: paint2.paint_source,
    paint_catalog_id: paint2.paint_catalog_id,
    custom_paint_id: paint2.custom_paint_id,
    paint_order: 2,
    ratio_text: ratio2,
  })
}

  if (paintId3) {
  stepPaintsToInsert.push({
    recipe_step_id: insertedStep.id,
    user_id: user.id,
    paint_source: paint3.paint_source,
    paint_catalog_id: paint3.paint_catalog_id,
    custom_paint_id: paint3.custom_paint_id,
    paint_order: 3,
    ratio_text: ratio3,
  })
}

  if (stepPaintsToInsert.length > 0) {
    const { error: stepPaintsError } = await supabase
      .from('recipe_step_paints')
      .insert(stepPaintsToInsert)

    if (stepPaintsError) {
      console.error('Error adding step paints:', stepPaintsError)
    }
  }

  revalidateRecipeCaches(recipeId)
}

async function updateRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const recipeId = formData.get('recipeId')?.toString()
  const stepId = formData.get('stepId')?.toString()
  const title = formData.get('title')?.toString().trim()
  const instructions = formData.get('instructions')?.toString().trim() || null
  const stepImage = formData.get('step_image') as File | null

  const paintId1 = formData.get('paintId1')?.toString() || ''
  const ratio1 = formData.get('ratio1')?.toString().trim() || null

  const paintId2 = formData.get('paintId2')?.toString() || ''
  const ratio2 = formData.get('ratio2')?.toString().trim() || null

  const paintId3 = formData.get('paintId3')?.toString() || ''
  const ratio3 = formData.get('ratio3')?.toString().trim() || null

  if (!recipeId || !stepId || !title) return

  let imageUrl: string | null = null

  if (stepImage && stepImage.size > 0) {
    const fileExt = stepImage.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/recipe-steps/${stepId}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(fileName, stepImage, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading step image:', uploadError)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('obsidian-images').getPublicUrl(fileName)

    imageUrl = publicUrl
  }

  const updatePayload: {
    title: string
    instructions: string | null
    image_url?: string
  } = {
    title,
    instructions,
  }

  if (imageUrl) {
    updatePayload.image_url = imageUrl
  }

  const { error: stepUpdateError } = await supabase
    .from('recipe_steps')
    .update(updatePayload)
    .eq('id', stepId)

  if (stepUpdateError) {
    console.error('Error updating recipe step:', stepUpdateError)
    return
  }

  const { error: deletePaintLinksError } = await supabase
    .from('recipe_step_paints')
    .delete()
    .eq('recipe_step_id', stepId)

  if (deletePaintLinksError) {
    console.error('Error clearing recipe step paints:', deletePaintLinksError)
    return
  }

  const paint1 = parsePaintSelection(paintId1)
  const paint2 = parsePaintSelection(paintId2)
  const paint3 = parsePaintSelection(paintId3)

  const stepPaintsToInsert = []

  if (paintId1) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      user_id: user.id,
      paint_source: paint1.paint_source,
      paint_catalog_id: paint1.paint_catalog_id,
      custom_paint_id: paint1.custom_paint_id,
      paint_order: 1,
      ratio_text: ratio1,
    })
  }

  if (paintId2) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      user_id: user.id,
      paint_source: paint2.paint_source,
      paint_catalog_id: paint2.paint_catalog_id,
      custom_paint_id: paint2.custom_paint_id,
      paint_order: 2,
      ratio_text: ratio2,
    })
  }

  if (paintId3) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      user_id: user.id,
      paint_source: paint3.paint_source,
      paint_catalog_id: paint3.paint_catalog_id,
      custom_paint_id: paint3.custom_paint_id,
      paint_order: 3,
      ratio_text: ratio3,
    })
  }

  if (stepPaintsToInsert.length > 0) {
    const { error: insertPaintLinksError } = await supabase
      .from('recipe_step_paints')
      .insert(stepPaintsToInsert)

    if (insertPaintLinksError) {
      console.error('Error re-adding recipe step paints:', insertPaintLinksError)
      return
    }
  }

  revalidateRecipeCaches(recipeId)
}

async function deleteRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const stepId = formData.get('stepId')?.toString()

  if (!recipeId || !stepId) return

  const { error: deleteError } = await supabase
    .from('recipe_steps')
    .delete()
    .eq('id', stepId)

  if (deleteError) {
    console.error('Error deleting recipe step:', deleteError)
    return
  }

  const { data: remainingSteps, error: fetchError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('recipe_id', recipeId)
    .order('step_number', { ascending: true })

  if (fetchError) {
    console.error('Error fetching remaining steps:', fetchError)
    return
  }

  for (let i = 0; i < (remainingSteps || []).length; i++) {
    const step = remainingSteps[i]
    const newStepNumber = i + 1

    if (step.step_number !== newStepNumber) {
      const { error: updateError } = await supabase
        .from('recipe_steps')
        .update({ step_number: newStepNumber })
        .eq('id', step.id)

      if (updateError) {
        console.error('Error resequencing recipe step:', updateError)
        return
      }
    }
  }

  revalidateRecipeCaches(recipeId)
}

async function moveRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const stepId = formData.get('stepId')?.toString()
  const direction = formData.get('direction')?.toString()

  if (!recipeId || !stepId || !direction) return

  const { data: currentStep, error: currentStepError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('id', stepId)
    .single()

  if (currentStepError || !currentStep) {
    console.error('Error fetching current recipe step:', currentStepError)
    return
  }

  const targetStepNumber =
    direction === 'up'
      ? currentStep.step_number - 1
      : currentStep.step_number + 1

  if (targetStepNumber < 1) return

  const { data: otherStep, error: otherStepError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('recipe_id', recipeId)
    .eq('step_number', targetStepNumber)
    .single()

  if (otherStepError || !otherStep) {
    return
  }

  const { error: firstUpdateError } = await supabase
    .from('recipe_steps')
    .update({ step_number: 9999 })
    .eq('id', currentStep.id)

  if (firstUpdateError) {
    console.error('Error temporarily moving current step:', firstUpdateError)
    return
  }

  const { error: secondUpdateError } = await supabase
    .from('recipe_steps')
    .update({ step_number: currentStep.step_number })
    .eq('id', otherStep.id)

  if (secondUpdateError) {
    console.error('Error moving adjacent recipe step:', secondUpdateError)
    return
  }

  const { error: thirdUpdateError } = await supabase
    .from('recipe_steps')
    .update({ step_number: targetStepNumber })
    .eq('id', currentStep.id)

  if (thirdUpdateError) {
    console.error('Error finalizing recipe step move:', thirdUpdateError)
    return
  }

  const { data: orderedSteps, error: orderedStepsError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('recipe_id', recipeId)
    .order('step_number', { ascending: true })

  if (orderedStepsError) {
    console.error('Error fetching ordered recipe steps:', orderedStepsError)
    return
  }

  for (let i = 0; i < (orderedSteps || []).length; i++) {
    const step = orderedSteps[i]
    const expectedStepNumber = i + 1

    if (step.step_number !== expectedStepNumber) {
      const { error: resequenceError } = await supabase
        .from('recipe_steps')
        .update({ step_number: expectedStepNumber })
        .eq('id', step.id)

      if (resequenceError) {
        console.error('Error resequencing recipe steps:', resequenceError)
        return
      }
    }
  }

  revalidateRecipeCaches(recipeId)
}

async function uploadRecipeImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const recipeId = formData.get('recipeId')?.toString()
  const altText = formData.get('altText')?.toString().trim() || null
  const uploadSource =
    formData.get('uploadSource') === 'camera' ? 'camera' : 'gallery_picker'
  const files = formData
    .getAll('image')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (!recipeId || files.length === 0) return

  const { data: existingFeatured } = await supabase
    .from('image_assets')
    .select('id')
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)
    .eq('is_featured', true)
    .limit(1)

  const result: GalleryUploadResult = {
    uploadedCount: 0,
    failed: [],
  }
  const hasFeaturedImage = Boolean(
    existingFeatured && existingFeatured.length > 0
  )

  for (const file of files) {
    const validationError = validateGalleryImageFile(file)

    if (validationError) {
      result.failed.push({ fileName: file.name, reason: validationError })
      continue
    }

    const fileExt = getSafeImageExtension(file.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `recipes/${recipeId}/${fileName}`
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading recipe image:', uploadError)
      result.failed.push({ fileName: file.name, reason: uploadError.message })
      continue
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('obsidian-images').getPublicUrl(filePath)

    const shouldBeFeatured = !hasFeaturedImage && result.uploadedCount === 0

    const { error: insertError } = await supabase.from('image_assets').insert([
      {
        user_id: user.id,
        entity_type: 'recipe',
        entity_id: recipeId,
        image_url: publicUrl,
        is_featured: shouldBeFeatured,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
        alt_text: altText,
      },
    ])

    if (insertError) {
      console.error('Error saving recipe image asset:', insertError)
      await supabase.storage.from('obsidian-images').remove([filePath])
      result.failed.push({ fileName: file.name, reason: insertError.message })
      continue
    }

    result.uploadedCount += 1

    await captureServerEvent({
      distinctId: user.id,
      event: 'image_uploaded',
      properties: {
        surface: 'recipe_gallery',
        recipe_id: recipeId,
        entity_id: recipeId,
        image_count: 1,
        is_featured: shouldBeFeatured,
        upload_source: uploadSource,
      },
    })
  }

  if (result.uploadedCount > 0) {
    revalidateRecipeCaches(recipeId)
  }

  return result
}

async function setFeaturedRecipeImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const imageId = formData.get('imageId')?.toString()

  if (!recipeId || !imageId) return

  const { error: clearError } = await supabase
    .from('image_assets')
    .update({ is_featured: false })
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)

  if (clearError) {
    console.error('Error clearing featured recipe image:', clearError)
    return
  }

  const { error: setError } = await supabase
    .from('image_assets')
    .update({ is_featured: true })
    .eq('id', imageId)

  if (setError) {
    console.error('Error setting featured recipe image:', setError)
    return
  }

  revalidateRecipeCaches(recipeId)
}

async function deleteRecipeImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const recipeId = formData.get('recipeId')?.toString()
  const imageIds = formData
    .getAll('imageIds')
    .map((value) => String(value))
    .filter(Boolean)
  const imageId = formData.get('imageId')?.toString()
  const targetImageIds = imageIds.length > 0 ? imageIds : imageId ? [imageId] : []

  if (!recipeId || targetImageIds.length === 0) return

  const { data: images, error: fetchError } = await supabase
    .from('image_assets')
    .select('id, storage_bucket, storage_path, is_featured')
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)
    .eq('user_id', user.id)
    .in('id', targetImageIds)

  if (fetchError || !images || images.length === 0) {
    console.error('Error fetching recipe image for delete:', fetchError)
    return
  }

  const storagePathsByBucket = images.reduce<Record<string, string[]>>(
    (acc, image) => {
      if (image.storage_bucket && image.storage_path) {
        acc[image.storage_bucket] = acc[image.storage_bucket] || []
        acc[image.storage_bucket].push(image.storage_path)
      }

      return acc
    },
    {}
  )

  for (const [bucket, paths] of Object.entries(storagePathsByBucket)) {
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove(paths)

    if (storageError) {
      console.error('Error deleting recipe image from storage:', storageError)
      return
    }
  }

  const { error: deleteError } = await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)
    .eq('user_id', user.id)
    .in('id', images.map((image) => image.id))

  if (deleteError) {
    console.error('Error deleting recipe image asset:', deleteError)
    return
  }

  if (images.some((image) => image.is_featured)) {
    const { data: remainingImages } = await supabase
      .from('image_assets')
      .select('id')
      .eq('entity_type', 'recipe')
      .eq('entity_id', recipeId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (remainingImages && remainingImages.length > 0) {
      await supabase
        .from('image_assets')
        .update({ is_featured: true })
        .eq('id', remainingImages[0].id)
    }
  }

  revalidateRecipeCaches(recipeId)
}

async function deleteRecipe(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const recipeId = formData.get('recipeId')?.toString()

  if (!recipeId) return

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (recipeError) {
    console.error('Error fetching recipe for delete:', recipeError)
    return
  }

  if (!recipe) {
    return
  }

  const { data: steps, error: stepsError } = await supabase
    .from('recipe_steps')
    .select('id')
    .eq('recipe_id', recipeId)

  if (stepsError) {
    console.error('Error fetching recipe steps for delete:', stepsError)
    return
  }

  const stepIds = steps?.map((step) => step.id) || []

  if (stepIds.length > 0) {
    const { error: stepPaintsError } = await supabase
      .from('recipe_step_paints')
      .delete()
      .in('recipe_step_id', stepIds)

    if (stepPaintsError) {
      console.error('Error deleting recipe step paints:', stepPaintsError)
      return
    }
  }

  const { error: stageRecipesError } = await supabase
    .from('unit_stage_recipes')
    .delete()
    .eq('recipe_id', recipeId)

  if (stageRecipesError) {
    console.error('Error deleting recipe stage links:', stageRecipesError)
    return
  }

  const { error: savedRecipesError } = await supabase
    .from('saved_recipes')
    .delete()
    .eq('recipe_id', recipeId)

  if (savedRecipesError) {
    console.error('Error deleting saved recipe links:', savedRecipesError)
    return
  }

  const { error: imageAssetsError } = await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)

  if (imageAssetsError) {
    console.error('Error deleting recipe images:', imageAssetsError)
    return
  }

  const { error: recipeStepsError } = await supabase
    .from('recipe_steps')
    .delete()
    .eq('recipe_id', recipeId)

  if (recipeStepsError) {
    console.error('Error deleting recipe steps:', recipeStepsError)
    return
  }

  const { error: deleteRecipeError } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (deleteRecipeError) {
    console.error('Error deleting recipe:', deleteRecipeError)
    return
  }

  revalidatePath('/recipes')
  revalidatePath('/dashboard')
  revalidateTag(`recipe:${recipeId}`, 'max')
  revalidateTag('public-recipes', 'max')

  redirect('/recipes')
}

async function getPrivateRecipeAssets(supabase: Awaited<ReturnType<typeof createClient>>, recipeId: string) {
  const [{ data: steps, error: stepsError }, { data: recipeImages, error: recipeImagesError }] =
    await Promise.all([
      supabase
        .from('recipe_steps')
        .select('id, step_number, title, instructions, image_url')
        .eq('recipe_id', recipeId)
        .order('step_number', { ascending: true }),
      supabase
        .from('image_assets')
        .select('id, image_url, is_featured, alt_text')
        .eq('entity_type', 'recipe')
        .eq('entity_id', recipeId)
        .order('created_at', { ascending: false }),
    ])

  if (stepsError) {
    console.error('Error fetching recipe steps:', stepsError)
  }

  if (recipeImagesError) {
    console.error('Error fetching recipe images:', recipeImagesError)
  }

  const stepIds = steps?.map((step) => step.id) || []

  const { data: stepPaintLinks, error: stepPaintLinksError } =
    stepIds.length > 0
      ? await supabase
          .from('recipe_step_paints')
          .select(`
            id,
            recipe_step_id,
            paint_order,
            ratio_text,
            paint_source,
            paint_catalog_id,
            custom_paint_id,
            catalog_paint:paint_catalog_id (
              id,
              brand,
              line,
              name,
              hex_approx,
              swatch_image_url
            ),
            custom_paint:custom_paint_id (
              id,
              name,
              manufacturer,
              series,
              color_hex,
              paint_type
            )
          `)
          .in('recipe_step_id', stepIds)
          .order('paint_order', { ascending: true })
      : { data: [], error: null }

  if (stepPaintLinksError) {
    console.error('Error fetching recipe step paint links:', stepPaintLinksError)
  }

  return {
    steps: steps || [],
    images: recipeImages || [],
    stepPaintLinks: stepPaintLinks || [],
  }
}

async function RecipeContestCardGate({
  userId,
  recipeId,
}: {
  userId: string
  recipeId: string
}) {
  const canSeeContestNominationCard = await isCurrentUserAdmin(userId)

  if (!canSeeContestNominationCard) {
    return null
  }

  const eligibleContests = await getEligibleContestsForSource(
    userId,
    'guide',
    recipeId
  )

  return (
    <NominateForContestCard
      contests={eligibleContests}
      sourceType="guide"
      sourceId={recipeId}
    />
  )
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const perf = createPerfTimer('/recipes/[id]')
  const { id } = await params
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  const cachedPublicRecipe = await getCachedPublicRecipe(id)
  const { data: privateRecipe } = cachedPublicRecipe
    ? { data: null }
    : user
      ? await supabase
          .from('recipes')
          .select('id, name, description, inventory_required, expert_tips, youtube_url, is_public, user_id')
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null }

  const recipe = cachedPublicRecipe || privateRecipe
  perf.mark('main Supabase query')

if (!recipe) {
  notFound()
}

const isOwner = Boolean(user && recipe.user_id === user.id)
  const profilePromise = user
    ? (async () => ({
        data: await getDashboardProfile(user.id),
      }))()
    : undefined

  const [
    recipeAssets,
    paintsCatalog,
    { data: ownershipRows, error: ownershipError },
    { data: customPaintRows, error: customPaintRowsError },
    socialState,
  ] = await Promise.all([
    cachedPublicRecipe
      ? getCachedPublicRecipeAssets(id)
      : getPrivateRecipeAssets(supabase, id),
    getCachedCatalogPaintOptions(),
    user
      ? supabase
          .from('user_paint_ownership')
          .select('paint_catalog_id, is_owned, is_wishlist')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase
          .from('paints')
          .select(`
            id,
            name,
            manufacturer,
            series,
            paint_type,
            color_hex
          `)
          .eq('user_id', user.id)
          .order('manufacturer', { ascending: true })
          .order('series', { ascending: true })
          .order('name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    getRecipeSocialState(supabase, id, user?.id),
  ])
  perf.mark('secondary Supabase queries')

  if (ownershipError) {
    console.error('Error fetching user paint ownership:', ownershipError)
  }

  if (customPaintRowsError) {
    console.error('Error fetching custom paints:', customPaintRowsError)
  }

  const steps = recipeAssets.steps
  const rawStepPaintLinks = recipeAssets.stepPaintLinks
  const recipeImages = recipeAssets.images

  const ownedPaintIds = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)
  )
const wishlistPaintIds = new Set(
  (ownershipRows || [])
    .filter((row) => row.is_wishlist)
    .map((row) => row.paint_catalog_id)
)
  const catalogPaintOptions =
    paintsCatalog?.map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      swatch_image_url: paint.swatch_image_url,
      hex_approx: paint.hex_approx,
      paint_type: paint.paint_type,
      is_owned: ownedPaintIds.has(paint.id),
      is_wishlist: wishlistPaintIds.has(paint.id),
    })) || []

  const customPaintOptions =
    customPaintRows?.map((paint) => ({
      id: paint.id,
      source: 'custom' as const,
      brand: paint.manufacturer,
      line: paint.series,
      name: paint.name,
      sku: null,
      swatch_image_url: null,
      hex_approx: paint.color_hex,
      paint_type: paint.paint_type,
      is_owned: true,
      is_wishlist: false,
    })) || []

  const paints = [...catalogPaintOptions, ...customPaintOptions].sort((a, b) => {
    const brandA = a.brand || ''
    const brandB = b.brand || ''
    const lineA = a.line || ''
    const lineB = b.line || ''
    const nameA = a.name || ''
    const nameB = b.name || ''

    return (
      brandA.localeCompare(brandB) ||
      lineA.localeCompare(lineB) ||
      nameA.localeCompare(nameB)
    )
  })

  const stepPaintLinks =
  rawStepPaintLinks?.map((link) => {
    const catalogPaint = Array.isArray(link.catalog_paint)
      ? link.catalog_paint[0]
      : link.catalog_paint

    const customPaint = Array.isArray(link.custom_paint)
      ? link.custom_paint[0]
      : link.custom_paint

    const paint =
  link.paint_source === 'custom' && customPaint
  ? {
      id: customPaint.id,
      brand: customPaint.manufacturer,
      line: customPaint.series,
      name: customPaint.name,
      hex_approx: customPaint.color_hex,
      swatch_image_url: null,
      is_owned: true,
      is_wishlist: false,
    }
        : catalogPaint
  ? {
      id: catalogPaint.id,
      brand: catalogPaint.brand,
      line: catalogPaint.line,
      name: catalogPaint.name,
      hex_approx: catalogPaint.hex_approx,
      swatch_image_url: catalogPaint.swatch_image_url,
      is_owned: ownedPaintIds.has(catalogPaint.id),
      is_wishlist: wishlistPaintIds.has(catalogPaint.id),
    }
          : null

    return {
      id: link.id,
      recipe_step_id: link.recipe_step_id,
      paint_order: link.paint_order,
      ratio_text: link.ratio_text,
      paint_source: link.paint_source,
      paint,
    }
  }) || []

  const featuredImage =
    recipeImages?.find((img) => img.is_featured) || recipeImages?.[0] || null
  perf.mark('image/gallery queries')
  perf.total()

  return (
  <main className="min-h-screen bg-[#081018] text-white">
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
      <Suspense fallback={<TopBarSkeleton />}>
        <DashboardTopBar userId={user?.id} profilePromise={profilePromise} />
      </Suspense>

      <RecipeDetailClient
  recipe={recipe}
  isOwner={isOwner}
  steps={steps || []}
        stepPaintLinks={stepPaintLinks}
        recipeImages={recipeImages || []}
        featuredImage={featuredImage}
        paints={paints}
        updateRecipeHeaderAction={updateRecipeHeader}
        updateRecipeInventoryAction={updateRecipeInventory}
        updateRecipeTipsAction={updateRecipeTips}
        addRecipeStepAction={addRecipeStep}
        updateRecipeStepAction={updateRecipeStep}
        deleteRecipeStepAction={deleteRecipeStep}
        moveRecipeStepAction={moveRecipeStep}
        uploadRecipeImageAction={uploadRecipeImage}
        setFeaturedRecipeImageAction={setFeaturedRecipeImage}
        deleteRecipeImageAction={deleteRecipeImage}
        updateRecipePaintOwnershipAction={updateRecipePaintOwnership}
        deleteRecipeAction={deleteRecipe}
        actionRow={
          <>
            {user && isOwner ? (
              <Suspense fallback={null}>
                <RecipeContestCardGate userId={user.id} recipeId={id} />
              </Suspense>
            ) : null}
          <ContentActionRow
            contentId={recipe.id}
            contentType="recipe"
            className=""
            likeCount={socialState.likeCount}
            saveCount={socialState.saveCount}
            viewerHasLiked={socialState.viewerHasLiked}
            viewerHasSaved={socialState.viewerHasSaved}
            viewerHasReported={socialState.viewerHasReported}
            toggleLikeAction={toggleRecipeLike}
            toggleSaveAction={toggleRecipeSave}
            reportAction={reportRecipe}
          />
          </>
        }
      />
    </div>
  </main>
)
}

