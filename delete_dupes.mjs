import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lidptdtnsvulvjdwkwvz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZHB0ZHRuc3Z1bHZqZHdrd3Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYxNjExNCwiZXhwIjoyMDkyMTkyMTE0fQ.tcAuMyJZvBUfuNo1SCxVCr-WkSdmWjYFV9NTKjMdSVo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: salons } = await supabase.from('salons').select('id, name, created_at').order('created_at', { ascending: true })
  
  const seenNames = new Set()
  const idsToDelete = []
  
  for (const salon of salons || []) {
    if (seenNames.has(salon.name)) {
      idsToDelete.push(salon.id)
      console.log(`Found duplicate salon: ${salon.name} (ID: ${salon.id})`)
    } else {
      seenNames.add(salon.name)
    }
  }

  if (idsToDelete.length > 0) {
    console.log(`Deleting ${idsToDelete.length} duplicates...`)
    const { error } = await supabase.from('salons').delete().in('id', idsToDelete)
    if (error) {
      console.error("Error deleting:", error)
    } else {
      console.log("Successfully deleted duplicates.")
    }
  } else {
    console.log("No duplicates found.")
  }
}

main()
