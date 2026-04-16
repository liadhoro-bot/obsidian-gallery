import { createClient } from '../../../utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MobileNav from '../../components/MobileNav'
import { revalidatePath } from 'next/cache'
import RecipeDetailClient from './recipe-detail-client'

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

async function addRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()

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

  const stepPaintsToInsert = []

  if (paintId1) {
    stepPaintsToInsert.push({
      recipe_step_id: insertedStep.id,
      paint_id: paintId1,
      paint_order: 1,
      ratio_text: ratio1,
    })
  }

  if (paintId2) {
    stepPaintsToInsert.push({
      recipe_step_id: insertedStep.id,
      paint_id: paintId2,
      paint_order: 2,
      ratio_text: ratio2,
    })
  }

  if (paintId3) {
    stepPaintsToInsert.push({
      recipe_step_id: insertedStep.id,
      paint_id: paintId3,
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
      return
    }
  }

  revalidatePath(`/recipes/${recipeId}`)
}
async function updateRecipeStep(formData: FormData) {
  'use server'

  const supabase = await createClient()

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

  const stepPaintsToInsert = []

  if (paintId1) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      paint_id: paintId1,
      paint_order: 1,
      ratio_text: ratio1,
    })
  }

  if (paintId2) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      paint_id: paintId2,
      paint_order: 2,
      ratio_text: ratio2,
    })
  }

  if (paintId3) {
    stepPaintsToInsert.push({
      recipe_step_id: stepId,
      paint_id: paintId3,
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
    const step = remainingSteps![i]
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
    const step = orderedSteps![i]
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
          paint:paints (
            id,
            name,
            manufacturer,
            color_hex
          )
        `)
        .in('recipe_step_id', stepIds)
        .order('paint_order', { ascending: true })
    : { data: [], error: null }

  const { data: paints } = await supabase
    .from('paints')
    .select('*')
    .order('name', { ascending: true })

  const { data: recipeImages, error: recipeImagesError } = await supabase
    .from('image_assets')
    .select('*')
    .eq('entity_type', 'recipe')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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
  stepPaintLinks={stepPaintLinks || []}
  recipeImages={recipeImages || []}
  featuredImage={featuredImage}
  paints={paints || []}
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
/>
    </main>
  )
}