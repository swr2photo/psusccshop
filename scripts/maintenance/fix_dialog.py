import sys

path = r'd:\shop\psusccshop\src\components\ProductDetailsDialog.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

bad_string = '''
                            {review.isOwner && (
                              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                                <IconButton size="small" onClick={() => onEditReview?.(review)} sx={{ p: 0.5 }}>
                                  <Edit size={14} color="var(--text-muted)" />
                                </IconButton>
                                <IconButton size="small" onClick={() => onDeleteReview?.(review.id)} sx={{ p: 0.5 }}>
                                  <Trash2 size={14} color="#ff453a" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>'''

# Replace all occurrences of bad_string with </Box>
content = content.replace(bad_string, '\n                          </Box>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed")
