### High Priority
- [x]Rereviewing cards is broken. "Failed to mark card correct: Error: Failed to record review: Review already recorded for today". The idea behind reviewing and rereviewing is that the firs time you review a pariticular verse for the day that is the only time it counts towards progress in phase, streak, etc. But you can always rereview the days verses. the first review of the day count_toward_progress is true, all the other times that verse is rereviewed for the day counted_toward_progress is false.
- [x] Add Page for individual verses that is accessed from the Library page when you click on a verse. It should open the full details of the verse itesle for management. i,e current phase, assigned day of week,month, week parity, streak, best streak, current phase progress count. it should not show archived that is for internal use only. they should have teh avility to "delete a verse" from here. delete in this case means to internally archive it. we dont actually want to delete data. 
- [x] Settings pages needs to be able to update all of the data that is from user_profiles besides user_id, id, created_at ofcourse. users should be able to change their email, name, display mode, translation. The settings page should accurately reflect these chagnes and sync like our other operations.
- [x]dont require login initially. BIG CHANGE TO Architecture. 
 we are saving to localindexDB and shouldbe able to sync up later. just if they want to persist across devices. Option to make an account can be in the settings page. DO NOT PUSH ACCOUNT CREATION. My app feel so easy to use and not be pushy for sign up creation AT ALL. 
    - determine the best way to handle supabase in this situation. Should it make an account without an email? Is that possible and then if they make an account it does it? Think HARD about this. This will likely change how we are using AuthProvider and useAuth throughout the app.

### Medium Priority
- if a verse is out of range, ie. user inputs john 3 99, should return an error to user instead of making the last verse in that chapter and creating an alias for it. this could cause a malicious user to pollute alias db with infinite number of bad data. should we hardcode last verse number of each book or let esv api handle it?

### Low Priority 
- [x] Batch requests for syncing, can we cache as well so multiple refreshes do not sync all of your verses if its already confirmed that it is synced? how can we do this?
- [x] move /tests into folder next to where the file/component is. i.e: every pages/AddVerse directory has AddVerse.tsx, Addverse.test.tsx, etc.

### Backlog
- [ ] 
