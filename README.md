WIP cdn that will support temporary file uploads

### `groupId` can be:

- A userId for posts/avatars/banners
- A channelId for messages

`POST /attachments/:groupId`

`POST /banners/:groupId`

`POST /avatars/:groupId`

`POST /emojis`

Please add a brief tutorial on how to actually start the CDN, for us it keeps trying to do this:![image](https://github.com/user-attachments/assets/1a412412-9d9f-48f3-a2d7-e4034db9c27a) saying that it is .appupload and not .app/upload
