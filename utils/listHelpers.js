function calcDistance(point1, point2) {
  return ((point1.x - point2.x) ** 2
        + (point1.y - point2.y) ** 2
        + (point1.z - point2.z) ** 2)
    ** 0.5;
}

function getRoutedList(shortList) {
  const routedList = [];
  routedList.push(shortList.shift());
  while (shortList.length > 0) {
    const last = routedList[routedList.length - 1];
    let closestIdx = 0;
    let closestDistance = calcDistance(last, shortList[0]);

    shortList.forEach((el, idx) => {
      const currDistance = calcDistance(last, el);
      if (closestDistance > currDistance) {
        closestIdx = idx;
        closestDistance = currDistance;
      }
    });

    routedList.push(shortList.splice(closestIdx, 1)[0]);
  }
  return routedList;
}

export { calcDistance, getRoutedList };
