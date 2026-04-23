import { createClient } from '../../../utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MobileNav from '../../components/MobileNav'
import { revalidatePath } from 'next/cache'
import RecipeDetailClient from './recipe-detail-client'

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

  revalidatePath(`/recipes/${recipeId}`)
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

  revalidatePath(`/recipes/${recipeId}`)
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

  revalidatePath(`/recipes/${recipeId}`)
}

async function createCustomPaint(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const recipeId = formData.get('recipeId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const manufacturer = formData.get('manufacturer')?.toString().trim() || null
  const series = formData.get('series')?.toString().trim() || null
  const paintType = formData.get('paintType')?.toString().trim() || null
  const colorHex = formData.get('colorHex')?.toString().trim() || null

  if (!recipeId || !name) return

  const { error } = await supabase.from('paints').insert([
    {
      user_id: user.id,
      name,
      manufacturer,
      series,
      paint_type: paintType,
      color_hex: colorHex,
    },
  ])

  if (error) {
    console.error('Error creating custom paint:', error)
    return
  }

  revalidatePath(`/recipes/${recipeId}`)
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
  const instructions = formData.get('instructions')?.toString().trim()

  const paintId1 = formData.get('paintId1')?.toString() || ''
  const ratio1 = formData.get('ratio1')?.toString().trim() || null

  const paintId2 = formData.get('paintId2')?.toString() || ''
  const ratio2 = formData.get('ratio2')?.toString().trim() || null

  const paintId3 = formData.get('paintId3')?.toString() || ''
  const ratio3 = formData.get('ratio3')?.toString().trim() || null

  if (!recipeId || !title || !instructions) return

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

  revalidatePath(`/recipes/${recipeId}`)
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
  const instructions = formData.get('instructions')?.toString().trim()

  const paintId1 = formData.get('paintId1')?.toString() || ''
  const ratio1 = formData.get('ratio1')?.toString().trim() || null

  const paintId2 = formData.get('paintId2')?.toString() || ''
  const ratio2 = formData.get('ratio2')?.toString().trim() || null

  const paintId3 = formData.get('paintId3')?.toString() || ''
  const ratio3 = formData.get('ratio3')?.toString().trim() || null

  console.log('updateRecipeStep submitted values:', {
    recipeId,
    stepId,
    title,
    instructions,
    paintId1,
    ratio1,
    paintId2,
    ratio2,
    paintId3,
    ratio3,
  })

  if (!recipeId || !stepId || !title || !instructions) return

  const { error: stepUpdateError } = await supabase
    .from('recipe_steps')
    .update({
      title,
      instructions,
    })
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

  console.log('stepPaintsToInsert before insert:', stepPaintsToInsert)

  if (stepPaintsToInsert.length > 0) {
    const { data: insertedPaintLinks, error: insertPaintLinksError } =
      await supabase
        .from('recipe_step_paints')
        .insert(stepPaintsToInsert)
        .select()

    if (insertPaintLinksError) {
      console.error('Error re-adding recipe step paints:', insertPaintLinksError)
      return
    }

    console.log('Inserted recipe_step_paints rows:', insertedPaintLinks)
  } else {
    console.log('No paint rows to insert. stepPaintsToInsert is empty.')
  }

  revalidatePath(`/recipes/${recipeId}`)
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

  revalidatePath(`/recipes/${recipeId}`)
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

  revalidatePath(`/recipes/${recipeId}`)
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
  const file = formData.get('image') as File | null

  if (!recipeId || !file || file.size === 0) return

  const fileExt = file.name.split('.').pop() || 'jpg'
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
    return
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('obsidian-images').getPublicUrl(filePath)

  const { data: existingFeatured } = await supabase
    .from('image_assets')
    .select('id')
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipeId)
    .eq('is_featured', true)
    .limit(1)

  const shouldBeFeatured = !existingFeatured || existingFeatured.length === 0

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
    return
  }

  revalidatePath(`/recipes/${recipeId}`)
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

  revalidatePath(`/recipes/${recipeId}`)
}

async function deleteRecipeImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const recipeId = formData.get('recipeId')?.toString()
  const imageId = formData.get('imageId')?.toString()

  if (!recipeId || !imageId) return

  const { data: image, error: fetchError } = await supabase
    .from('image_assets')
    .select('id, storage_bucket, storage_path, is_featured')
    .eq('id', imageId)
    .single()

  if (fetchError || !image) {
    console.error('Error fetching recipe image for delete:', fetchError)
    return
  }

  if (image.storage_bucket && image.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(image.storage_bucket)
      .remove([image.storage_path])

    if (storageError) {
      console.error('Error deleting recipe image from storage:', storageError)
      return
    }
  }

  const { error: deleteError } = await supabase
    .from('image_assets')
    .delete()
    .eq('id', imageId)

  if (deleteError) {
    console.error('Error deleting recipe image asset:', deleteError)
    return
  }

  if (image.is_featured) {
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

  revalidatePath(`/recipes/${recipeId}`)
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (recipeError || !recipe) {
    notFound()
  }

  const { data: steps, error: stepsError } = await supabase
    .from('recipe_steps')
    .select('*')
    .eq('recipe_id', id)
    .order('step_number', { ascending: true })

  if (stepsError) {
    console.error('Error fetching recipe steps:', stepsError)
  }

  const stepIds = steps?.map((step) => step.id) || []

  const { data: rawStepPaintLinks, error: stepPaintLinksError } =
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

  const { data: paintsCatalog, error: paintsCatalogError } = await supabase
    .from('paint_catalog')
    .select(`
      id,
      brand,
      line,
      name,
      sku,
      swatch_image_url,
      hex_approx,
      finish,
      paint_type
    `)
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })

  if (paintsCatalogError) {
    console.error('Error fetching paint catalog:', paintsCatalogError)
  }

  const { data: ownershipRows, error: ownershipError } = await supabase
    .from('user_paint_ownership')
    .select('paint_catalog_id, is_owned')
    .eq('user_id', user.id)

  if (ownershipError) {
    console.error('Error fetching user paint ownership:', ownershipError)
  }

  const { data: customPaintRows, error: customPaintRowsError } = await supabase
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

  if (customPaintRowsError) {
    console.error('Error fetching custom paints:', customPaintRowsError)
  }

  const ownedPaintIds = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_owned)
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
          }
        : catalogPaint
          ? {
              id: catalogPaint.id,
              brand: catalogPaint.brand,
              line: catalogPaint.line,
              name: catalogPaint.name,
              hex_approx: catalogPaint.hex_approx,
              swatch_image_url: catalogPaint.swatch_image_url,
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

  const { data: recipeImages, error: recipeImagesError } = await supabase
    .from('image_assets')
    .select('*')
    .eq('entity_type', 'recipe')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (recipeImagesError) {
    console.error('Error fetching recipe images:', recipeImagesError)
  }

  const featuredImage =
    recipeImages?.find((img) => img.is_featured) || recipeImages?.[0] || null

  return (
    <main className="min-h-screen bg-black pb-28 text-white">
      <MobileNav />

      <div className="px-4 pt-4">
        <a href="/recipes" className="text-cyan-400">
          ← Back to Recipes
        </a>
      </div>

      <RecipeDetailClient
        recipe={recipe}
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
        createCustomPaintAction={createCustomPaint}
      />
    </main>
  )
}