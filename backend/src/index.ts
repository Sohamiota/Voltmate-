import app from './app';

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => {
  console.log(`server listening on ${port}`);
});

