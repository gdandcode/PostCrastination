export function publicProfile(row) {
  return { id: row.id, username: row.display_name, profileVisibility: row.visible ? 'public' : 'private' };
}
export function ownProfile(row) {
  return {...publicProfile(row),fullName:row.full_name,studyLocation:row.study_location,onboardingComplete:row.onboarding_complete,accountRole:row.account_role,streakAdmin:row.streak_admin===true,accountType:row.school_id?'school':'personal',schoolId:row.school_id};
}
export async function ensureProfile(pool, identity) {
  const name = typeof identity.name === 'string' ? identity.name.trim().slice(0, 80) : '';
  const { rows } = await pool.query(`INSERT INTO app.community_profiles(firebase_uid,display_name,onboarding_complete,account_role)
    VALUES ($1,$2,$3,'student') ON CONFLICT(firebase_uid) DO UPDATE SET onboarding_complete=app.community_profiles.onboarding_complete OR EXCLUDED.onboarding_complete
    RETURNING id,display_name,visible,study_location,onboarding_complete,full_name,account_role,school_id,streak_admin`, [identity.uid, name || 'Student', !identity.firebase || identity.firebase.sign_in_provider === 'password']);
  return ownProfile(rows[0]);
}
export async function updateProfile(pool, identity, body) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !['username','visible','studyLocation','completeSetup','fullName'].includes(k))) throw Object.assign(new Error('Unsupported profile fields.'), { status: 400 });
  if (body.username !== undefined && (typeof body.username !== 'string' || !body.username.trim() || body.username.trim().length > 80)) throw Object.assign(new Error('Name must be between 1 and 80 characters.'), { status: 400 });
  if (body.visible !== undefined && typeof body.visible !== 'boolean') throw Object.assign(new Error('Visibility must be true or false.'), { status: 400 });
  if (body.studyLocation !== undefined && (typeof body.studyLocation !== 'string' || body.studyLocation.length>120)) throw Object.assign(new Error('Study location must be at most 120 characters.'),{status:400});
  if (body.completeSetup !== undefined && body.completeSetup !== true) throw Object.assign(new Error('Invalid setup status.'),{status:400});
  if (body.completeSetup && !body.username?.trim()) throw Object.assign(new Error('Choose a username to finish setup.'),{status:400});
  if(body.fullName!==undefined&&(typeof body.fullName!=='string'||body.fullName.trim().length>160))throw Object.assign(new Error('Full name must be at most 160 characters.'),{status:400});
  await ensureProfile(pool, identity);
  const { rows } = await pool.query(`UPDATE app.community_profiles SET
    display_name=COALESCE($2,display_name),visible=COALESCE($3,visible),study_location=COALESCE($4,study_location),onboarding_complete=onboarding_complete OR COALESCE($5,false),full_name=COALESCE($6,full_name)
    WHERE firebase_uid=$1 RETURNING id,display_name,visible,study_location,onboarding_complete,full_name,account_role,school_id,streak_admin`, [identity.uid, body.username?.trim() ?? null, body.visible ?? null,body.studyLocation?.trim() ?? null,body.completeSetup ?? false,body.fullName?.trim() ?? null]);
  return ownProfile(rows[0]);
}
export async function listProfiles(pool, url) {
  const raw = url.searchParams.get('page') || '0';
  if (!/^\d{1,5}$/.test(raw)) throw Object.assign(new Error('Invalid page.'), { status: 400 });
  const page = Number(raw);
  const { rows } = await pool.query('SELECT id,display_name,visible FROM app.community_profiles WHERE visible AND onboarding_complete ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $1', [page * 24]);
  return { people: rows.slice(0,24).map(publicProfile), hasMore: rows.length > 24 };
}
