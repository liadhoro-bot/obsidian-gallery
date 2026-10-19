-- Help-tour copy for /guides still described guides as collections of
-- "decks". Decks are now guides (a guide is made of cards and can reuse
-- other guides), so reword those rows. Copy only: uids, targets and order
-- are unchanged. Rows that no longer exist are simply not updated.

begin;

update public.feature_guide set explanation = 'Opens Guides: your guides, guides you saved, and the public guide library.'
where uid = 'global.mobile_nav.guides' and page_path = '/guides';

update public.feature_guide set explanation = 'The guide hub: your guides, guides you saved, and the public library of guides.'
where uid = 'guides.page' and page_path = '/guides';

update public.feature_guide set explanation = 'Explains that a guide is made of cards and can reuse other guides inside it, and that the library is where public guides can be found and saved.'
where uid = 'guides.help' and page_path = '/guides';

update public.feature_guide set feature_name = 'Create guide',
  explanation = 'Starts a new guide from a template, a unit, a project, photos, a paint list, or a blank page.'
where uid = 'guides.create_button' and page_path = '/guides';

update public.feature_guide set explanation = 'Shows your guides, including guides that reuse other guides.'
where uid = 'guides.tabs.guides' and page_path = '/guides';

update public.feature_guide set feature_name = 'My Guides tab',
  explanation = 'Shows the guides you made, ready to open, edit, or reuse inside another guide.'
where uid = 'guides.tabs.decks' and page_path = '/guides';

update public.feature_guide set explanation = 'Shows public guides that can be searched, inspected, and saved.'
where uid = 'guides.tabs.library' and page_path = '/guides';

update public.feature_guide set explanation = 'Searches public guides by title, subtitle, and level.'
where uid = 'guides.library_search' and page_path = '/guides';

update public.feature_guide set feature_name = 'Save guide',
  explanation = 'Saves or removes a public guide from your library.'
where uid = 'guides.deck_save' and page_path = '/guides';

update public.feature_guide set feature_name = 'Guide starters',
  explanation = 'Chooses how to start a new guide: a template, a unit, a project, photos, a paint list, or blank.'
where uid = 'guides.forge.mode' and page_path = '/guides';

update public.feature_guide set feature_name = 'Select guides',
  explanation = 'Lets the user choose guides to reuse inside a new guide, in order.'
where uid = 'guides.forge.deck_picker' and page_path = '/guides';

commit;
